import logging
import os
import tempfile
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User
from app.services.aws_model_services import (
    model_categorize_transaction,
    model_parse_bank_statement_metadata,
    model_parse_document,
)
from app.services.aws_services import AWSService
from app.services.reconciliation_matching import MatchConfig
from app.services.reconciliation_runner import run_reconciliation
from app.utils.pdf_plumber import parse_statement

logger = logging.getLogger("sqs_worker.handlers")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
PDF_EXTENSIONS = {".pdf"}


def _safe_decimal(value) -> Decimal:
    if value is None or str(value).strip().lower() == "n/a":
        raise ValueError("Missing required amount field")
    cleaned = str(value).replace(",", "").replace("$", "").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        raise ValueError(f"Cannot convert '{value}' to Decimal")


def _safe_date(value, field_name: str = "date") -> date:
    today = date.today()
    if value is None or str(value).strip().lower() == "n/a":
        logger.warning(
            f"Missing date field '{field_name}', defaulting to today ({today})"
        )
        return today
    raw = str(value).strip()
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        logger.warning(
            f"Invalid date format for '{field_name}': expected YYYY-MM-DD, got '{raw}'. "
            f"Defaulting to today ({today})"
        )
        return today


def _construct_date_with_year(
    value, year, start_month, field_name: str = "date"
) -> date:
    today = date.today()
    if value is None or str(value).strip().lower() == "n/a":
        logger.warning(
            f"Missing date field '{field_name}', defaulting to today ({today})"
        )
        return today
    raw = str(value).strip()
    try:
        parts = raw.split("/")
        month = int(parts[0])
        day = int(parts[1])
        adjusted_year = (
            year + 1 if month < start_month else year
        )  # for statements that span across 2 years (Dec - Jan)
        # add adjusted year to raw month/date
        constructed_date = f"{adjusted_year}-{month:02d}-{day:02d}"
        return datetime.strptime(constructed_date, "%Y-%m-%d").date()
    except (ValueError, IndexError):
        logger.warning(
            f"Invalid date format for '{field_name}': expected MM/DD, got '{raw}'. "
            f"Defaulting to today ({today})"
        )
        return today


def _safe_str(value, fallback: str = "") -> str:
    if value is None or str(value).strip().lower() == "n/a":
        return fallback
    return str(value).strip()


def _download_to_temp(aws: AWSService, s3_key: str) -> str:
    """Download an S3 object to a temp file, returning the path."""
    _, ext = os.path.splitext(s3_key)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.close()
    if not aws.download_file(s3_key, tmp.name):
        os.unlink(tmp.name)
        raise RuntimeError(f"Failed to download s3://{s3_key}")
    return tmp.name


async def handle_parse_receipt(payload: dict, session: AsyncSession, aws: AWSService):
    document_id = payload["document_id"]
    s3_key = payload["s3_key"]
    statement_id = payload.get("statement_id")

    tmp_path = _download_to_temp(aws, s3_key)
    try:
        _, ext = os.path.splitext(s3_key)
        ext = ext.lower()

        if ext in IMAGE_EXTENSIONS or ext in PDF_EXTENSIONS:
            parsed = model_parse_document(tmp_path)
        else:
            raise ValueError(f"Unsupported file extension for receipt: {ext}")

        if not parsed:
            raise ValueError("Model returned empty response for receipt")

        categorized = model_categorize_transaction(parsed)
        expense_type = categorized.get("expense_type") if categorized else None

        receipt = Receipt(
            vendor=_safe_str(parsed.get("vendor"), "Unknown"),
            invoice_number=_safe_str(parsed.get("invoice_number")) or None,
            billing_date=_safe_date(parsed.get("date"), "date"),
            charged_amount=_safe_decimal(parsed.get("total")),
            description=_safe_str(parsed.get("purchase_desc")) or None,
            expense_type=expense_type,
            statement_id=statement_id,
        )
        session.add(receipt)
        await session.flush()

        doc = await session.get(Document, document_id)
        if doc is None:
            raise ValueError(f"Document {document_id} not found")
        doc.receipt_id = receipt.receipt_id

        logger.info(f"Created Receipt {receipt.receipt_id} for document {document_id}")
    finally:
        os.unlink(tmp_path)


async def handle_parse_statement(payload: dict, session: AsyncSession, aws: AWSService):
    document_id = payload["document_id"]
    s3_key = payload["s3_key"]
    account_id = payload.get("account_id")

    if account_id is None:
        raise ValueError("account_id is required in payload for bank statements")

    tmp_path = _download_to_temp(aws, s3_key)
    try:
        metadata = model_parse_bank_statement_metadata(tmp_path)
        if not metadata:
            raise ValueError("Model returned empty metadata for bank statement")

        stmt_date = _safe_date(metadata.get("statement_date"), "statement_date")

        df = parse_statement(tmp_path)
        if df.empty:
            raise ValueError("pdfplumber extracted zero transaction lines")

        total_amount = Decimal(str(df["charge"].astype(float).sum())).quantize(
            Decimal("0.01")
        )

        statement = BankStatement(
            account_id=account_id,
            month=stmt_date.month,
            year=stmt_date.year,
            account_number_last4=_safe_str(metadata.get("last_4_digits"), "0000"),
            total_amount=total_amount,
        )
        session.add(statement)
        await session.flush()

        for line_num, (_, row) in enumerate(df.iterrows(), start=1):
            line = BankStatementLine(
                statement_id=statement.statement_id,
                line_number=line_num,
                reference_number=str(row.get("reference", "")),
                transaction_date=_construct_date_with_year(
                    row.get("transaction_date"),
                    stmt_date.year,
                    stmt_date.month,
                    "transaction_date",
                ),
                posting_date=_construct_date_with_year(
                    row.get("posting_date"),
                    stmt_date.year,
                    stmt_date.month,
                    "posting_date",
                ),
                description=str(row.get("description", "")),
                vendor=str(row.get("description", "")).split()[0]
                if row.get("description")
                else "",
                mcc=str(row.get("mcc", "")) or None,
                charge=_safe_decimal(row.get("charge")),
            )
            session.add(line)

        await session.flush()

        doc = await session.get(Document, document_id)
        if doc is None:
            raise ValueError(f"Document {document_id} not found")
        doc.statement_id = statement.statement_id

        logger.info(
            f"Created BankStatement {statement.statement_id} "
            f"with {len(df)} lines for document {document_id}"
        )
    finally:
        os.unlink(tmp_path)


async def handle_reconciliation(payload: dict, session: AsyncSession, aws: AWSService):
    job_id = payload["job_id"]
    account_id = payload["account_id"]
    statement_id = payload.get("statement_id")
    user_id = payload["user_id"]
    config_data = payload.get("config")

    job = await session.get(Job, job_id)
    if job is None:
        raise ValueError(f"Job {job_id} not found")

    user = await session.get(User, user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    match_config = MatchConfig(**config_data) if config_data else None

    await run_reconciliation(job, account_id, statement_id, session, user, match_config)
    logger.info(f"Reconciliation job {job_id} completed")

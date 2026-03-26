import logging
import os
import tempfile
from decimal import Decimal

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
from app.utils.date_parsing import parse_mmdd_with_year
from app.utils.money_parsing import parse_money_amount
from app.utils.pdf_plumber import parse_statement

logger = logging.getLogger("sqs_worker.handlers")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
PDF_EXTENSIONS = {".pdf"}


def _download_to_temp(aws: AWSService, s3_key: str) -> str:
    """Download an S3 object to a temp file, returning the path."""
    _, ext = os.path.splitext(s3_key)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.close()
    if not aws.download_file(s3_key, tmp.name):
        os.unlink(tmp.name)
        raise RuntimeError(f"Failed to download s3://{s3_key}")
    return tmp.name


def _line_charge_value(raw) -> Decimal:
    if isinstance(raw, Decimal):
        return raw.quantize(Decimal("0.01"))
    return parse_money_amount(raw, field_name="charge")


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

        categorized = model_categorize_transaction(parsed)
        expense_type = categorized.expense_type

        receipt = Receipt(
            vendor=parsed.vendor,
            invoice_number=parsed.invoice_number,
            billing_date=parsed.date,
            charged_amount=parsed.total,
            description=parsed.purchase_desc,
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
        stmt_date = metadata.statement_date

        df = parse_statement(tmp_path)
        if df.empty:
            raise ValueError("pdfplumber extracted zero transaction lines")

        total_amount = sum(
            (_line_charge_value(row.get("charge")) for _, row in df.iterrows()),
            Decimal("0"),
        ).quantize(Decimal("0.01"))

        statement = BankStatement(
            account_id=account_id,
            month=stmt_date.month,
            year=stmt_date.year,
            account_number_last4=metadata.last_4_digits,
            total_amount=total_amount,
        )
        session.add(statement)
        await session.flush()

        for line_num, (_, row) in enumerate(df.iterrows(), start=1):
            desc = str(row.get("description", "")).strip()
            if not desc:
                raise ValueError(
                    f"Statement line {line_num}: missing description after parse"
                )
            ref = str(row.get("reference", "")).strip()
            if not ref:
                raise ValueError(
                    f"Statement line {line_num}: missing reference number after parse"
                )
            vendor_token = desc.split()[0]

            line = BankStatementLine(
                statement_id=statement.statement_id,
                line_number=line_num,
                reference_number=ref,
                transaction_date=parse_mmdd_with_year(
                    row.get("transaction_date"),
                    statement_date=stmt_date,
                    field_name="transaction_date",
                ),
                posting_date=parse_mmdd_with_year(
                    row.get("posting_date"),
                    statement_date=stmt_date,
                    field_name="posting_date",
                ),
                description=desc,
                vendor=vendor_token,
                mcc=str(row.get("mcc", "")).strip() or None,
                charge=_line_charge_value(row.get("charge")),
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

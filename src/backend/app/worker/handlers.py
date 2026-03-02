import logging
import os
import tempfile
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.receipt import Receipt
from app.models.statement import BankStatement, BankStatementLine
from app.services.aws_model_services import (
    model_parse_bank_statement_metadata,
    model_parse_image,
    model_parse_pdf,
)
from app.services.aws_services import AWSService
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
    if value is None or str(value).strip().lower() == "n/a":
        raise ValueError(f"Missing required date field: '{field_name}'")
    raw = str(value).strip()
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(
            f"Invalid date format for '{field_name}': expected YYYY-MM-DD, got '{raw}'"
        )


def _construct_date_with_year(value, year, field_name: str = "date") -> date:
    if value is None or str(value).strip().lower() == "n/a":
        raise ValueError(f"Missing required date field: '{field_name}'")
    raw = str(value).strip()
    parts = raw.split("/")
    # add year to raw month/date
    constructed_date = f"{year}-{parts[0]}-{parts[1]}"
    try:
        return datetime.strptime(constructed_date, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(
            f"Invalid date format for '{field_name}': expected MM/DD, got '{raw}'"
        )


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

        if ext in IMAGE_EXTENSIONS:
            parsed = model_parse_image(tmp_path)
        elif ext in PDF_EXTENSIONS:
            parsed = model_parse_pdf(tmp_path)
        else:
            raise ValueError(f"Unsupported file extension for receipt: {ext}")

        if not parsed:
            raise ValueError("Model returned empty response for receipt")

        receipt = Receipt(
            vendor=_safe_str(parsed.get("vendor"), "Unknown"),
            invoice_number=_safe_str(parsed.get("invoice_number")) or None,
            billing_date=_safe_date(parsed.get("date"), "date"),
            charged_amount=_safe_decimal(parsed.get("total")),
            description=_safe_str(parsed.get("purchase_desc")) or None,
            statement_id=statement_id,
        )
        session.add(receipt)
        await session.flush()

        doc = await session.get(Document, document_id)
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

        for idx, row in df.iterrows():
            line = BankStatementLine(
                statement_id=statement.statement_id,
                line_number=idx + 1,
                reference_number=str(row.get("reference", "")),
                transaction_date=_construct_date_with_year(
                    row.get("transaction_date"), stmt_date.year, "transaction_date"
                ),
                posting_date=_construct_date_with_year(
                    row.get("posting_date"), stmt_date.year, "posting_date"
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
        doc.statement_id = statement.statement_id

        logger.info(
            f"Created BankStatement {statement.statement_id} "
            f"with {len(df)} lines for document {document_id}"
        )
    finally:
        os.unlink(tmp_path)

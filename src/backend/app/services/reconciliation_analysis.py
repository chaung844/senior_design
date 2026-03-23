"""
AI-powered analysis of unmatched statement lines after reconciliation.

After the matching algorithm completes, this service collects each unmatched
statement line alongside its top candidate receipts (with scoring breakdowns),
sends the data to AWS Bedrock for analysis, and persists the structured results
in the ``reconciliation_line_summaries`` table.

The analysis is **non-blocking to reconciliation**: if the Bedrock call fails
the reconciliation job still completes successfully and the summary tab shows
a graceful empty state.
"""

import json
import logging
from typing import Any

from rich import print
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.enums import MatchStatus
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.reconciliation_summary import ReconciliationLineSummary
from app.models.statement import BankStatementLine
from app.services.aws_model_services import call_model
from app.services.reconciliation_matching import (
    MatchConfig,
    _date_score,
    _vendor_score,
    calculate_confidence,
    calculate_soft_pair_score,
    candidate_pair_sort_key,
    line_vendor_similarity,
)

logger = logging.getLogger(__name__)
settings = get_settings()

TOP_CANDIDATES_COUNT = 3


def _rejection_reasons(
    line: BankStatementLine,
    receipt: Receipt,
    confidence: int,
    cfg: MatchConfig,
) -> list[str]:
    """Compute human-readable rejection reasons for a candidate pair."""
    reasons: list[str] = []
    amount_exact = line.charge == receipt.charged_amount
    days_diff = abs((line.transaction_date - receipt.billing_date).days)
    vendor_similarity = line_vendor_similarity(line, receipt)

    if not amount_exact:
        reasons.append(
            f"Amount mismatch: line=${float(line.charge):.2f} vs receipt=${float(receipt.charged_amount):.2f}"
        )
    if days_diff > cfg.max_date_window:
        reasons.append(
            f"Date outside window: {days_diff} days apart (max {cfg.max_date_window})"
        )
    if vendor_similarity < cfg.min_vendor_similarity_pass1b:
        reasons.append(
            f"Vendor similarity below Pass 1b floor: {vendor_similarity:.0f}% "
            f"(min {cfg.min_vendor_similarity_pass1b}%)"
        )
    if confidence < cfg.confidence_threshold:
        reasons.append(
            f"Confidence too low: {confidence}/100 (threshold {cfg.confidence_threshold})"
        )
    if vendor_similarity < cfg.bundle_vendor_threshold:
        reasons.append(
            f"Weak vendor similarity: {vendor_similarity:.0f}% "
            f"(bundle threshold {cfg.bundle_vendor_threshold}%)"
        )
    if not reasons:
        reasons.append("Candidate was valid but consumed by a higher-priority match")
    return reasons


def gather_unmatched_analysis_data(
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    config: MatchConfig | None = None,
) -> list[dict[str, Any]]:
    """Build structured analysis data for every unmatched line.

    Returns a list of dicts, one per unmatched line, each containing the line
    info and its top candidate receipts with scoring breakdowns.
    """
    cfg = config if config is not None else MatchConfig()
    all_receipts = [r for r in receipts]
    receipt_by_id = {r.receipt_id: r for r in all_receipts}
    result: list[dict[str, Any]] = []

    for line in lines:
        if line.match_status != MatchStatus.unmatched:
            continue

        candidates = []
        for receipt in all_receipts:
            confidence = calculate_confidence(line, receipt, cfg)
            vendor_sim = line_vendor_similarity(line, receipt)
            v_score = _vendor_score(line, receipt)
            d_score = _date_score(line, receipt, cfg)
            days_diff = abs((line.transaction_date - receipt.billing_date).days)
            amount_exact = line.charge == receipt.charged_amount
            soft_pair = calculate_soft_pair_score(line, receipt, cfg)
            reasons = _rejection_reasons(line, receipt, confidence, cfg)

            candidates.append(
                {
                    "receipt_id": receipt.receipt_id,
                    "vendor": receipt.vendor or "",
                    "charged_amount": str(receipt.charged_amount),
                    "billing_date": str(receipt.billing_date),
                    "confidence": confidence,
                    "soft_pair_score": soft_pair,
                    "amount_exact": amount_exact,
                    "vendor_similarity": round(vendor_sim, 1),
                    "vendor_score": v_score,
                    "date_score": d_score,
                    "days_diff": days_diff,
                    "rejection_reasons": reasons,
                }
            )

        candidates.sort(
            key=lambda c: candidate_pair_sort_key(
                line,
                receipt_by_id[c["receipt_id"]],
                c["confidence"],
                cfg,
            ),
        )
        top = candidates[:TOP_CANDIDATES_COUNT]

        result.append(
            {
                "line_id": line.line_id,
                "statement_id": line.statement_id,
                "vendor": line.vendor or "",
                "description": line.description or "",
                "charge": str(line.charge),
                "transaction_date": str(line.transaction_date),
                "top_candidates": top,
            }
        )

    return result


def build_analysis_prompt(unmatched_data: list[dict[str, Any]]) -> str:
    """Build a single prompt containing all unmatched lines for Bedrock analysis."""
    lines_block = json.dumps(unmatched_data, indent=2)
    prompt = (
        "You are an expert bank reconciliation analyst. Below is a JSON array of "
        "unmatched bank statement lines. Each entry contains the statement line details "
        "and up to 3 top candidate receipts that were considered but rejected by the "
        "automated matching algorithm, along with their scoring breakdown and rejection reasons.\n\n"
        "For each unmatched line, provide a concise analysis (2-4 sentences) explaining:\n"
        "1. Why this line likely has no matching receipt (based on the data)\n"
        "2. What the user should look for when manually reviewing\n"
        "3. If any candidate receipt looks close, explain specifically what differs\n\n"
        "Return your response as a YAML list keyed by line_id. Example format:\n"
        "```yaml\n"
        "- line_id: 123\n"
        '  analysis: "Your analysis here."\n'
        "- line_id: 456\n"
        '  analysis: "Your analysis here."\n'
        "```\n\n"
        "IMPORTANT: Return ONLY the YAML block, no other text.\n\n"
        f"Unmatched lines data:\n{lines_block}"
    )
    return prompt


def _parse_analysis_response(
    raw_response: str,
    unmatched_data: list[dict[str, Any]],
) -> dict[int, str]:
    """Parse the YAML response from Bedrock into a {line_id: analysis} mapping.

    Falls back to assigning the full response to every line if parsing fails.
    """
    from app.utils.llm_utils import parse_yaml, sanitize_llm_output

    line_ids = [item["line_id"] for item in unmatched_data]

    try:
        sanitized = sanitize_llm_output(raw_response)
        parsed = parse_yaml(sanitized)

        if isinstance(parsed, list):
            mapping: dict[int, str] = {}
            for entry in parsed:
                if isinstance(entry, dict) and "line_id" in entry:
                    mapping[int(entry["line_id"])] = str(entry.get("analysis", ""))
            if mapping:
                return mapping

        if isinstance(parsed, dict):
            mapping = {}
            for key, value in parsed.items():
                try:
                    lid = int(key)
                except (ValueError, TypeError):
                    continue
                if isinstance(value, dict):
                    mapping[lid] = str(value.get("analysis", ""))
                else:
                    mapping[lid] = str(value)
            if mapping:
                return mapping
    except Exception:
        logger.warning(
            "Failed to parse YAML from Bedrock response, using raw text", exc_info=True
        )

    return {lid: raw_response for lid in line_ids}


async def analyze_and_store(
    job: Job,
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    db: AsyncSession,
    config: MatchConfig | None = None,
    statement_id: int | None = None,
) -> None:
    """Orchestrator: gather unmatched data, call Bedrock, store results.

    Wrapped in try/except so a Bedrock failure never fails the reconciliation.
    """
    try:
        unmatched_data = gather_unmatched_analysis_data(lines, receipts, config)

        if not unmatched_data:
            logger.info("No unmatched lines — skipping AI analysis")
            return

        prompt = build_analysis_prompt(unmatched_data)
        print(prompt)
        raw_response = await run_in_threadpool(
            call_model,
            settings.llm_model_id,
            settings.reconciliation_summary_instruction_path,
            None,
            prompt,
            None,
        )
        analysis_map = _parse_analysis_response(raw_response, unmatched_data)

        for item in unmatched_data:
            line_id = item["line_id"]
            sid = statement_id if statement_id is not None else item["statement_id"]

            top_candidates_json = [
                {
                    "receipt_id": c["receipt_id"],
                    "vendor": c["vendor"],
                    "charged_amount": c["charged_amount"],
                    "billing_date": c["billing_date"],
                    "confidence": c["confidence"],
                    "soft_pair_score": c["soft_pair_score"],
                    "rejection_reasons": c["rejection_reasons"],
                }
                for c in item["top_candidates"]
            ]

            summary = ReconciliationLineSummary(
                job_id=job.job_id,
                line_id=line_id,
                statement_id=sid,
                top_candidates=top_candidates_json,
                ai_analysis=analysis_map.get(line_id, "Analysis unavailable."),
            )
            db.add(summary)

        await db.flush()
        logger.info(
            "Stored AI analysis for %d unmatched lines (job %d)",
            len(unmatched_data),
            job.job_id,
        )
    except Exception:
        logger.warning(
            "AI analysis failed for job %d — reconciliation will still complete",
            job.job_id,
            exc_info=True,
        )

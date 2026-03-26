"""
CLI task: archive statements whose retention period has elapsed.

Usage::

    # Production run
    uv run python -m app.tasks.archive_statements

    # Preview what would be archived without making changes
    uv run python -m app.tasks.archive_statements --dry-run

Designed to be executed by a cron job or AWS EventBridge scheduled rule
(e.g. daily at 03:00 UTC).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from app.config import get_settings
from app.logging_setup import configure_rich_logging

_settings = get_settings()
configure_rich_logging(
    level=logging.DEBUG if _settings.debug else logging.INFO,
    debug=_settings.debug,
)

from app.database import AsyncSessionLocal, engine
from app.services.archival import archive_eligible_statements
from app.services.aws_services import get_aws_service

logger = logging.getLogger("archival")


async def _run(*, dry_run: bool) -> int:
    aws_service = get_aws_service()

    async with AsyncSessionLocal() as db:
        report = await archive_eligible_statements(
            db, aws_service, dry_run=dry_run
        )

    await engine.dispose()

    prefix = "[DRY RUN] " if dry_run else ""
    logger.info(
        "%sArchival complete: %d statement(s) archived, "
        "%d S3 object(s) deleted, %d S3 error(s)",
        prefix,
        report.statements_archived,
        report.s3_objects_deleted,
        report.s3_delete_errors,
    )

    if report.errors:
        logger.error(
            "%d statement(s) failed to archive:", len(report.errors)
        )
        for err in report.errors:
            logger.error("  %s", err)
        return 1

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Archive statements past their retention period.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Log what would be archived without making any changes.",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(_run(dry_run=args.dry_run))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

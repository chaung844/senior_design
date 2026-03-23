import asyncio
import json
import logging
import signal
from typing import Any, Dict

from app.config import get_settings
from app.logging_setup import configure_rich_logging

_settings = get_settings()
configure_rich_logging(
    level=logging.DEBUG if _settings.debug else logging.INFO,
    debug=_settings.debug,
)

from sqlalchemy.exc import DBAPIError, OperationalError

from app.database import AsyncSessionLocal, engine
from app.enums import DocumentStatus, JobStatus, JobType
from app.models.document import Document
from app.models.job import Job
from app.services.aws_services import get_aws_service
from app.worker.handlers import (
    handle_parse_receipt,
    handle_parse_statement,
    handle_reconciliation,
)

logger = logging.getLogger("sqs_worker")

HANDLER_REGISTRY: Dict[str, Any] = {
    "parse_receipt": handle_parse_receipt,
    "parse_statement": handle_parse_statement,
    "run_reconciliation": handle_reconciliation,
}

HEARTBEAT_INTERVAL_SEC = 60

# Retry settings for transient DB connection errors
MAX_DB_RETRIES = 3
RETRY_BASE_DELAY_SEC = 1.0


def _is_connection_error(exc: Exception) -> bool:
    """Return True if the exception looks like a transient connection failure."""
    if isinstance(exc, (OperationalError, DBAPIError)):
        msg = str(exc).lower()
        indicators = [
            "connection was closed",
            "connectiondoesnotexisterror",
            "connection reset",
            "connection refused",
            "broken pipe",
            "server closed the connection",
            "ssl connection has been closed",
            "could not connect",
            "timeout expired",
            "connection timed out",
        ]
        return any(ind in msg for ind in indicators)
    return False


async def _dispose_pool() -> None:
    """Dispose the engine's connection pool so the next checkout creates a fresh connection."""
    logger.info("Disposing connection pool to force fresh connections")
    await engine.dispose()


class SQSWorker:
    def __init__(self):
        self.aws = get_aws_service()
        self._shutdown = False

    def _register_signals(self):
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, self._handle_signal)

    def _handle_signal(self, signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self._shutdown = True

    def _start_heartbeat(self, receipt_handle: str) -> asyncio.Event:
        """Periodically extend SQS visibility timeout while processing."""
        stop_event = asyncio.Event()

        async def _heartbeat():
            while not stop_event.is_set():
                try:
                    await asyncio.wait_for(
                        stop_event.wait(), timeout=HEARTBEAT_INTERVAL_SEC
                    )
                    # If we get here, the event was set — stop.
                    break
                except asyncio.TimeoutError:
                    pass
                logger.debug("Extending visibility timeout")
                await self.aws.async_extend_visibility_timeout(receipt_handle)

        asyncio.get_running_loop().create_task(_heartbeat())
        return stop_event

    async def _mark_processing(
        self, document_id: int, job_id: int | None
    ) -> str | None:
        """
        Check the document status and mark it as processing.

        Returns:
            None   – if the document was successfully marked as processing
            "skip" – if the document is already processing/parsed (should be skipped)
            "discard" – if the document was not found (should be discarded)
        """
        async with AsyncSessionLocal() as session:
            doc = await session.get(Document, document_id)
            if doc is None:
                return "discard"

            if doc.status in (
                DocumentStatus.processing,
                DocumentStatus.parsed,
            ):
                return "skip"

            doc.status = DocumentStatus.processing

            if job_id is not None:
                job = await session.get(Job, job_id)
                if job is None:
                    logger.error(f"Job {job_id} not found for document {document_id}")
                else:
                    if job.job_type == JobType.parsing:
                        job.status = JobStatus.processing

            await session.commit()
        return None

    async def _run_handler(
        self,
        handler,
        payload: dict,
        document_id: int,
        job_id: int | None,
    ) -> None:
        """Run the parsing handler and mark the document/job as completed."""
        async with AsyncSessionLocal() as session:
            await handler(payload, session, self.aws)
            await session.commit()

            doc = await session.get(Document, document_id)
            if doc:
                doc.status = DocumentStatus.parsed

            if job_id is not None:
                job = await session.get(Job, job_id)
                if job and job.job_type == JobType.parsing:
                    job.status = JobStatus.completed

            await session.commit()

    async def _mark_failed(
        self, document_id: int, job_id: int | None, error: str
    ) -> None:
        """Mark the document and job as failed in a fresh session."""
        async with AsyncSessionLocal() as err_session:
            doc = await err_session.get(Document, document_id)
            if doc:
                doc.status = DocumentStatus.failed
                doc.error_message = error[:1000]

            if job_id is not None:
                job = await err_session.get(Job, job_id)
                if job and job.job_type == JobType.parsing:
                    job.status = JobStatus.failed

            await err_session.commit()

    # --- Job-centric helpers (for messages without a document_id) ----------

    async def _mark_job_status(self, job_id: int, status: JobStatus) -> None:
        """Set a job's status in a dedicated session."""
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            if job is not None:
                job.status = status
            await session.commit()

    async def _run_job_handler(
        self, handler, payload: dict, job_id: int | None
    ) -> None:
        """Run a job-only handler; the handler itself sets final status."""
        async with AsyncSessionLocal() as session:
            await handler(payload, session, self.aws)
            await session.commit()

    async def _mark_job_failed(self, job_id: int, error: str) -> None:
        """Mark a job as failed in a fresh session."""
        async with AsyncSessionLocal() as err_session:
            job = await err_session.get(Job, job_id)
            if job is not None:
                job.status = JobStatus.failed
            await err_session.commit()

    async def _with_retry(self, operation_name: str, coro_factory):
        """
        Execute an async callable with retry logic for transient DB connection errors.

        ``coro_factory`` is a zero-argument callable that returns an awaitable each time
        it is invoked (so we get a fresh coroutine on every retry).
        """
        last_exc: Exception | None = None

        for attempt in range(1, MAX_DB_RETRIES + 1):
            try:
                return await coro_factory()
            except Exception as exc:
                last_exc = exc
                if _is_connection_error(exc) and attempt < MAX_DB_RETRIES:
                    delay = RETRY_BASE_DELAY_SEC * (2 ** (attempt - 1))
                    logger.warning(
                        f"[{operation_name}] Transient DB connection error on attempt "
                        f"{attempt}/{MAX_DB_RETRIES}: {exc!r}. "
                        f"Disposing pool and retrying in {delay:.1f}s..."
                    )
                    await _dispose_pool()
                    await asyncio.sleep(delay)
                else:
                    raise

        # Should not reach here, but just in case:
        raise last_exc  # type: ignore[misc]

    async def _process_message(self, message: dict):
        receipt_handle = message["ReceiptHandle"]
        stop_heartbeat = self._start_heartbeat(receipt_handle)

        try:
            body = json.loads(message["Body"])
            msg_type = body["type"]
            payload = body["payload"]

            handler = HANDLER_REGISTRY.get(msg_type)
            if handler is None:
                logger.error(f"Unknown message type: {msg_type}")
                await self.aws.async_delete_message(receipt_handle)
                return

            document_id = payload.get("document_id")

            if document_id is not None:
                await self._process_document_message(
                    handler, msg_type, payload, document_id, receipt_handle
                )
            else:
                await self._process_job_message(
                    handler, msg_type, payload, receipt_handle
                )

        except Exception as e:
            logger.exception(f"Failed to process SQS message: {e}")
        finally:
            stop_heartbeat.set()

    async def _process_document_message(
        self, handler, msg_type: str, payload: dict,
        document_id: int, receipt_handle: str,
    ) -> None:
        """Document-centric flow (parsing jobs)."""
        job_id = payload.get("job_id")

        result = await self._with_retry(
            f"mark_processing(doc={document_id})",
            lambda: self._mark_processing(document_id, job_id),
        )

        if result == "discard":
            logger.error(f"Document {document_id} not found, discarding")
            await self.aws.async_delete_message(receipt_handle)
            return

        if result == "skip":
            logger.info(
                f"Document {document_id} already processing/parsed, skipping"
            )
            await self.aws.async_delete_message(receipt_handle)
            return

        logger.info(f"Processing document {document_id} with handler '{msg_type}'")

        try:
            await self._with_retry(
                f"handler({msg_type}, doc={document_id})",
                lambda: self._run_handler(handler, payload, document_id, job_id),
            )
            logger.info(f"Document {document_id} parsed successfully")
            await self.aws.async_delete_message(receipt_handle)

        except Exception as e:
            handler_error = e
            logger.exception(
                f"Handler failed for document {document_id}: {handler_error}"
            )
            try:
                await self._with_retry(
                    f"mark_failed(doc={document_id})",
                    lambda: self._mark_failed(
                        document_id, job_id, str(handler_error)
                    ),
                )
            except Exception as mark_err:
                logger.error(
                    f"Could not mark document {document_id} as failed: {mark_err}"
                )

    async def _process_job_message(
        self, handler, msg_type: str, payload: dict, receipt_handle: str,
    ) -> None:
        """Job-centric flow (reconciliation and other non-document jobs)."""
        job_id = payload.get("job_id")

        if job_id is not None:
            await self._with_retry(
                f"mark_job_processing(job={job_id})",
                lambda: self._mark_job_status(job_id, JobStatus.processing),
            )

        logger.info(f"Processing job {job_id} with handler '{msg_type}'")

        try:
            await self._with_retry(
                f"handler({msg_type}, job={job_id})",
                lambda: self._run_job_handler(handler, payload, job_id),
            )
            logger.info(f"Job {job_id} completed via handler '{msg_type}'")
            await self.aws.async_delete_message(receipt_handle)

        except Exception as e:
            handler_error = e
            logger.exception(f"Handler failed for job {job_id}: {handler_error}")
            if job_id is not None:
                try:
                    await self._with_retry(
                        f"mark_job_failed(job={job_id})",
                        lambda: self._mark_job_failed(job_id, str(handler_error)),
                    )
                except Exception as mark_err:
                    logger.error(
                        f"Could not mark job {job_id} as failed: {mark_err}"
                    )

    async def run(self):
        self._register_signals()
        logger.info("SQS Worker started, polling for messages...")

        while not self._shutdown:
            messages = await self.aws.async_receive_messages(
                max_messages=1, wait_time=20
            )

            if not messages:
                continue

            for message in messages:
                if self._shutdown:
                    break
                await self._process_message(message)

        logger.info("SQS Worker shut down.")


async def run_worker():
    worker = SQSWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())

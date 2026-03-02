import asyncio
import json
import logging
import signal
import threading
from typing import Any, Dict

from app.database import AsyncSessionLocal
from app.enums import DocumentStatus, JobStatus, JobType
from app.models.document import Document
from app.models.job import Job
from app.services.aws_services import AWSService
from app.worker.handlers import handle_parse_receipt, handle_parse_statement

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sqs_worker")

HANDLER_REGISTRY: Dict[str, Any] = {
    "parse_receipt": handle_parse_receipt,
    "parse_statement": handle_parse_statement,
}

HEARTBEAT_INTERVAL_SEC = 60


class SQSWorker:
    def __init__(self):
        self.aws = AWSService()
        self._shutdown = False

    def _register_signals(self):
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, self._handle_signal)

    def _handle_signal(self, signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self._shutdown = True

    def _start_heartbeat(self, receipt_handle: str) -> threading.Event:
        """Periodically extend SQS visibility timeout while processing."""
        stop_event = threading.Event()

        def _heartbeat():
            while not stop_event.is_set():
                stop_event.wait(HEARTBEAT_INTERVAL_SEC)
                if stop_event.is_set():
                    break
                logger.debug("Extending visibility timeout")
                self.aws.extend_visibility_timeout(receipt_handle)

        t = threading.Thread(target=_heartbeat, daemon=True)
        t.start()
        return stop_event

    async def _process_message(self, message: dict):
        receipt_handle = message["ReceiptHandle"]
        stop_heartbeat = self._start_heartbeat(receipt_handle)

        try:
            body = json.loads(message["Body"])
            msg_type = body["type"]
            payload = body["payload"]
            document_id = payload["document_id"]
            job_id = payload.get("job_id")

            handler = HANDLER_REGISTRY.get(msg_type)
            if handler is None:
                logger.error(f"Unknown message type: {msg_type}")
                self.aws.delete_message(receipt_handle)
                return

            async with AsyncSessionLocal() as session:
                doc = await session.get(Document, document_id)
                if doc is None:
                    logger.error(f"Document {document_id} not found, discarding")
                    self.aws.delete_message(receipt_handle)
                    return

                if doc.status in (
                    DocumentStatus.processing,
                    DocumentStatus.parsed,
                ):
                    logger.info(
                        f"Document {document_id} already {doc.status.value}, skipping"
                    )
                    self.aws.delete_message(receipt_handle)
                    return

                doc.status = DocumentStatus.processing

                if job_id is not None:
                    job = await session.get(Job, job_id)
                    if job is None:
                        logger.error(f"Job {job_id} not found for document {document_id}")
                    else:
                        # Only update parsing jobs here; reconciliation jobs are handled elsewhere.
                        if job.job_type == JobType.parsing:
                            job.status = JobStatus.processing

                await session.commit()

            logger.info(
                f"Processing document {document_id} with handler '{msg_type}'"
            )

            async with AsyncSessionLocal() as session:
                try:
                    await handler(payload, session, self.aws)
                    await session.commit()

                    doc = await session.get(Document, document_id)
                    if doc:
                        doc.status = DocumentStatus.parsed

                    if job_id is not None:
                        job = await session.get(Job, job_id)
                        if job:
                            if job.job_type == JobType.parsing:
                                job.status = JobStatus.completed

                    await session.commit()

                    logger.info(f"Document {document_id} parsed successfully")
                    self.aws.delete_message(receipt_handle)

                except Exception as e:
                    await session.rollback()
                    logger.exception(
                        f"Handler failed for document {document_id}: {e}"
                    )
                    async with AsyncSessionLocal() as err_session:
                        doc = await err_session.get(Document, document_id)
                        if doc:
                            doc.status = DocumentStatus.failed
                            doc.error_message = str(e)[:1000]

                        if job_id is not None:
                            job = await err_session.get(Job, job_id)
                            if job and job.job_type == JobType.parsing:
                                job.status = JobStatus.failed

                        await err_session.commit()

        except Exception as e:
            logger.exception(f"Failed to process SQS message: {e}")
        finally:
            stop_heartbeat.set()

    async def run(self):
        self._register_signals()
        logger.info("SQS Worker started, polling for messages...")

        while not self._shutdown:
            messages = self.aws.receive_messages(max_messages=1, wait_time=20)

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

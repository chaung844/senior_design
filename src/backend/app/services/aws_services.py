import json
import logging
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi.concurrency import run_in_threadpool

from app.config import get_settings

settings = get_settings()


class AWSService:
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key.get_secret_value(),
            endpoint_url=f"https://s3.{settings.aws_region}.amazonaws.com",
            config=Config(signature_version="s3v4"),
        )

        self.sqs_client = boto3.client(
            "sqs",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key.get_secret_value(),
        )
        self.bucket_name = settings.s3_bucket_name
        self.sqs_url = settings.aws_sqs_url

    def generate_presigned_url(self, s3_key: str, file_type: str):
        try:
            return self.s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                    "ContentType": file_type,
                },
                ExpiresIn=settings.s3_presigned_url_expire_time,
            )
        except ClientError as e:
            logging.error(f"Error generating presigned URL: {e}")
            return None

    def verify_s3_upload(self, s3_key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            logging.error(f"Error verifying S3 upload: {e}")
            return False

    def download_file(self, s3_key: str, local_path: str) -> bool:
        try:
            self.s3_client.download_file(self.bucket_name, s3_key, local_path)
            return True
        except ClientError as e:
            logging.error(f"Error downloading file from S3: {e}")
            return False

    def enqueue_parsing(self, message_type: str, payload: dict):
        try:
            return self.sqs_client.send_message(
                QueueUrl=self.sqs_url,
                MessageBody=json.dumps({"type": message_type, "payload": payload}),
            )
        except ClientError as e:
            logging.error(f"SQS error: {e}")
            return None

    def receive_messages(self, max_messages: int = 1, wait_time: int = 20):
        try:
            response = self.sqs_client.receive_message(
                QueueUrl=self.sqs_url,
                MaxNumberOfMessages=max_messages,
                WaitTimeSeconds=wait_time,
                AttributeNames=["ApproximateReceiveCount"],
            )
            return response.get("Messages", [])
        except ClientError as e:
            logging.error(f"SQS receive error: {e}")
            return []

    def delete_message(self, receipt_handle: str):
        try:
            self.sqs_client.delete_message(
                QueueUrl=self.sqs_url,
                ReceiptHandle=receipt_handle,
            )
        except ClientError as e:
            logging.error(f"SQS delete error: {e}")

    def generate_presigned_get_url(
        self, s3_key: str, expires_in: int = settings.s3_presigned_url_expire_time
    ) -> "str | None":
        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=expires_in,
            )
        except ClientError as e:
            logging.error(f"Error generating presigned GET URL: {e}")
            return None

    def delete_s3_object(self, s3_key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            logging.error(f"Error deleting S3 object: {e}")
            return False

    def extend_visibility_timeout(self, receipt_handle: str, timeout: int = 120):
        try:
            self.sqs_client.change_message_visibility(
                QueueUrl=self.sqs_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=timeout,
            )
        except ClientError as e:
            logging.error(f"SQS visibility timeout extension error: {e}")

    # ------------------------------------------------------------------
    # Async wrappers: use these from async route handlers / workers
    # to avoid blocking the event loop with synchronous boto3 calls.
    # ------------------------------------------------------------------

    async def async_generate_presigned_url(self, s3_key: str, file_type: str):
        return await run_in_threadpool(self.generate_presigned_url, s3_key, file_type)

    async def async_verify_s3_upload(self, s3_key: str) -> bool:
        return await run_in_threadpool(self.verify_s3_upload, s3_key)

    async def async_download_file(self, s3_key: str, local_path: str) -> bool:
        return await run_in_threadpool(self.download_file, s3_key, local_path)

    async def async_enqueue_parsing(self, message_type: str, payload: dict):
        return await run_in_threadpool(self.enqueue_parsing, message_type, payload)

    async def async_receive_messages(self, max_messages: int = 1, wait_time: int = 20):
        return await run_in_threadpool(self.receive_messages, max_messages, wait_time)

    async def async_delete_message(self, receipt_handle: str):
        return await run_in_threadpool(self.delete_message, receipt_handle)

    async def async_generate_presigned_get_url(
        self,
        s3_key: str,
        expires_in: int = settings.s3_presigned_url_expire_time,
    ) -> "str | None":
        return await run_in_threadpool(
            self.generate_presigned_get_url, s3_key, expires_in
        )

    async def async_delete_s3_object(self, s3_key: str) -> bool:
        return await run_in_threadpool(self.delete_s3_object, s3_key)

    async def async_extend_visibility_timeout(
        self, receipt_handle: str, timeout: int = 120
    ):
        return await run_in_threadpool(
            self.extend_visibility_timeout, receipt_handle, timeout
        )


@lru_cache(maxsize=1)
def get_aws_service() -> AWSService:
    """Return a cached singleton AWSService instance.

    Use as a FastAPI dependency::

        aws: AWSService = Depends(get_aws_service)

    This avoids module-level instantiation (which crashes imports when
    env vars are missing) and makes the service easy to mock in tests.
    """
    return AWSService()


async def generate_file_url(
    s3_key: "str | None",
    aws_service: AWSService,
    *,
    not_found_detail: str = "No document linked to this resource",
    failure_detail: str = "Failed to generate download URL",
) -> str:
    """Generate a presigned GET URL for *s3_key* and raise appropriate
    ``HTTPException`` values on failure.

    This eliminates the repeated check-then-generate-then-raise pattern that
    appears in every ``get_*_file_url`` route handler.

    Args:
        s3_key: The S3 object key to generate a URL for.
        aws_service: The :class:`AWSService` instance to use.
        not_found_detail: 404 detail message when *s3_key* is falsy.
        failure_detail: 500 detail message when URL generation fails.

    Returns:
        The presigned URL string.

    Raises:
        HTTPException(404): if *s3_key* is empty/``None``.
        HTTPException(500): if the presigned URL could not be generated.
    """
    from fastapi import HTTPException  # local import to avoid circular dependency

    if not s3_key:
        raise HTTPException(status_code=404, detail=not_found_detail)

    _settings = get_settings()
    expires_in = _settings.s3_presigned_url_expire_time
    url = await aws_service.async_generate_presigned_get_url(
        s3_key, expires_in=expires_in
    )
    if not url:
        raise HTTPException(status_code=500, detail=failure_detail)
    return url

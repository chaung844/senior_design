import json
import logging

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

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
                ExpiresIn=3600,
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

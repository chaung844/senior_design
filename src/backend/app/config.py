"""
pydantic-settings Application Configuration.

All values can be overridden via environment variables or a `.env` file
located in the project root (src/backend/.env).
"""

from functools import lru_cache  # caching for efficient settings retrieval
from pathlib import Path
from typing import List

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application settings.

    Secrets and server config are loaded from environment variables / `.env`.
    """

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server / App ──────────────────────────────────────────────────
    app_name: str = Field(
        default="senior-design-backend", description="Application name"
    )
    debug: bool = Field(default=False, description="Enable debug mode")
    host: str = Field(default="0.0.0.0", description="Server bind host")
    port: int = Field(default=8000, description="Server bind port")
    base_path: Path = Field(default=Path("safe/"), description="Base data directory")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # ── AWS / Model Secrets ───────────────────────────────────────────
    aws_bedrock_api_key: SecretStr = Field(
        ...,
        description="AWS Bedrock API key (required)",
    )
    aws_region: str = Field(default="us-east-2", description="AWS region")
    aws_access_key_id: str = Field(..., description="AWS Access Key ID")
    aws_secret_access_key: SecretStr = Field(..., description="AWS Secret Access Key")
    s3_bucket_name: str = Field(..., description="S3 bucket name for document storage")
    aws_sqs_url: str = Field(
        ..., description="AWS SQS URL for document processing queue"
    )

    # ── Model Configuration ───────────────────────────────────────────
    llm_model_id: str = Field(
        default="deepseek.v3.2",
        description="Bedrock model identifier",
    )
    vlm_model_id: str = Field(
        default="qwen.qwen3-vl-235b-a22b",
        description="Bedrock model identifier",
    )
    max_input_tokens: int = Field(default=16384, description="Max input tokens")
    max_output_tokens: int = Field(
        default=2048, description="Max output / completion tokens"
    )
    temperature: float = Field(
        default=0.0, ge=0.0, le=2.0, description="Sampling temperature"
    )
    top_p: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Top-p (nucleus) sampling"
    )

    # ── Image / PDF Processing ────────────────────────────────────────
    max_image_inputs: int = Field(default=5, description="Max images per request")
    max_image_dimension: int = Field(
        default=2048, description="Max width/height for images"
    )
    jpeg_quality: int = Field(
        default=80, ge=1, le=100, description="JPEG compression quality"
    )
    pdf_dpi: int = Field(default=150, description="DPI for PDF-to-image conversion")

    # ── Prompt / Instruction Paths ────────────────────────────────────
    receipt_parsing_instruction_path: str = Field(
        default="safe/prompts/receipts_parsing_instructions.md",
        description="Relative path (under base_path) to system instruction file for parsing receipts",
    )
    categorizing_instruction_path: str = Field(
        default="safe/prompts/categorizing_instructions.md",
        description="Relative path (under base_path) to system instruction file for categorizing receipts purchases",
    )
    bankstatement_metadata_parsing_instruction_path: str = Field(
        default="safe/prompts/bankstatement_metadata_parsing_instructions.md",
        description="Relative path (under base_path) to system instruction file for parsing bank statement metadata",
    )

    # ── Convenience helpers ───────────────────────────────────────────
    @property
    def bedrock_base_url(self) -> str:
        """Fully-qualified Bedrock OpenAI-compatible endpoint."""
        return f"https://bedrock-runtime.{self.aws_region}.amazonaws.com/openai/v1"

    def bedrock_health_check_url(self) -> str:
        """Bedrock health check endpoint."""
        return f"https://bedrock.{self.aws_region}.amazonaws.com/foundation-models"

    # ── Database configuration ──────────────────────────────────────────────
    database_url: SecretStr = Field(..., description="Database connection URL")

    # ── Auth / JWT ──────────────────────────────────────────────────────────
    jwt_secret_key: SecretStr = Field(..., description="JWT signing secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    access_token_expire_minutes: int = Field(
        default=1440, description="Access token expiration time in minutes"
    )
    # Set to True in production (HTTPS only).  Keep False for local HTTP dev
    # so the browser does not silently drop the cookies.
    cookie_secure: bool = Field(
        default=False,
        description="Set the Secure flag on auth cookies (requires HTTPS)",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Return a cached singleton of the application settings.

    Usage::

        from config import get_settings

        settings = get_settings()
        print(settings.aws_region)
        print(settings.aws_bedrock_api_key.get_secret_value())
    """
    return Settings()

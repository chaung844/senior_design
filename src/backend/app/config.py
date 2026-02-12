"""
pydantic-settings Application Configuration.

All values can be overridden via environment variables or a `.env` file
located in the project root (src/backend/.env).
"""

from functools import lru_cache  # caching for efficient settings retrieval
from pathlib import Path

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

    # ── AWS / Model Secrets ───────────────────────────────────────────
    aws_bedrock_api_key: SecretStr = Field(
        ...,
        description="AWS Bedrock API key (required)",
    )
    aws_region: str = Field(default="us-east-1", description="AWS region")

    # ── Model Configuration ───────────────────────────────────────────
    model_id: str = Field(
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

    # ── Convenience helpers ───────────────────────────────────────────
    @property
    def bedrock_base_url(self) -> str:
        """Fully-qualified Bedrock OpenAI-compatible endpoint."""
        return f"https://bedrock-runtime.{self.aws_region}.amazonaws.com/openai/v1"


@lru_cache
def get_settings() -> Settings:
    """
    Return a cached singleton of the application settings.

    Usage::

        from app.config import get_settings

        settings = get_settings()
        print(settings.aws_region)
        print(settings.aws_bedrock_api_key.get_secret_value())
    """
    return Settings()

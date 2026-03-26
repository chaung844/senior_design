import base64
import io
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, TypeVar

import yaml
from pydantic import BaseModel, ValidationError
from pdf2image import convert_from_path
from PIL import Image

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def encode_image_file(image_path):
    """
    Encodes a local image file to a base64 Data URI, resizing and
    compressing it to stay within API payload limits.

    Args:
        image_path (str): Path to the local image file.

    Returns:
        str: Base64 Data URI of the image.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Local file not found: {image_path}")

    try:
        img = Image.open(image_path)
        if (
            img.width > settings.max_image_dimension
            or img.height > settings.max_image_dimension
        ):
            img.thumbnail((settings.max_image_dimension, settings.max_image_dimension))
            logger.info(f"Resized image to {img.width}x{img.height}")
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=settings.jpeg_quality)
        base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
    except FileNotFoundError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to encode image file: {image_path} — {e}") from e

    return f"data:image/jpeg;base64,{base64_image}"


def encode_pil_image(pil_image):
    """
    Encodes a PIL Image object (from pdf2image) to a base64 Data URI.

    Args:
        pil_image (PIL.Image): The PIL Image object to encode.

    Returns:
        str: Base64 Data URI of the image.
    """
    if pil_image.mode in ("RGBA", "P"):
        pil_image = pil_image.convert("RGB")
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG", quality=settings.jpeg_quality)
    base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{base64_image}"


def process_pdf(pdf_path, max_pages=6, resize=True):
    """
    Converts PDF pages to base64 images, processing pages in parallel for performance.

    Args:
        pdf_path (str): Path to the PDF file.
        max_pages (int): Maximum number of pages to convert.
        resize (bool): Whether to resize large images to fit within MAX_IMAGE_DIMENSION.

    Returns:
        list: List of base64 Data URI strings for each page image.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    logger.info(f"Processing PDF: {pdf_path} (Max {max_pages} pages)...")
    try:
        images = convert_from_path(
            pdf_path, dpi=settings.pdf_dpi, first_page=1, last_page=max_pages
        )
        logger.info(f"Extracted {len(images)} pages.")

        def _process_image_helper(img):
            if resize and (
                img.width > settings.max_image_dimension
                or img.height > settings.max_image_dimension
            ):
                img.thumbnail(
                    (settings.max_image_dimension, settings.max_image_dimension)
                )
            return encode_pil_image(img)

        with ThreadPoolExecutor() as executor:
            base64_images = list(executor.map(_process_image_helper, images))

        return base64_images
    except FileNotFoundError:
        raise
    except Exception as e:
        raise RuntimeError(
            f"Error converting PDF: {e} (Tip: is 'poppler' installed?)"
        ) from e


def sanitize_llm_output(raw_content):
    """
    Strips Markdown code blocks (```yaml ... ```) from LLM output.

    Args:
        raw_content (str): The raw content from the LLM.

    Returns:
        str: The sanitized content without Markdown code blocks.
    """
    # Strip whitespace first
    content = raw_content.strip()

    # Regex to capture content inside ``` blocks
    pattern = r"```(?:yaml|yml)?\n(.*?)```"
    match = re.search(pattern, content, re.DOTALL)

    if match:
        # Return the captured group inside the backticks
        return match.group(1).strip()

    # If no code blocks found, return original (assuming it's raw YAML)
    return content


def parse_yaml(content):
    """
    Parses YAML content from a string.

    Args:
        content (str): The content to parse.

    Returns:
        Parsed Python object (typically dict or list).
    """
    try:
        return yaml.safe_load(content)
    except yaml.YAMLError as e:
        raise ValueError(f"Failed to parse YAML: {e}")


TModel = TypeVar("TModel", bound=BaseModel)


def extract_yaml_block(raw_content: str) -> str:
    """Return YAML text, stripping markdown fences when present."""
    if raw_content is None:
        raise ValueError("Empty LLM response")
    s = str(raw_content).strip()
    if not s:
        raise ValueError("Empty LLM response")
    return sanitize_llm_output(s)


def parse_yaml_strict(
    yaml_str: str,
    *,
    expected_root_type: type | tuple[type, ...] = dict,
) -> Any:
    """Parse YAML and verify the document root type."""
    data = parse_yaml(yaml_str)
    if not isinstance(data, expected_root_type):
        raise ValueError(
            f"Expected YAML root type {expected_root_type!r}, got {type(data).__name__}"
        )
    return data


def parse_yaml_to_model(
    raw: str,
    model: type[TModel],
    *,
    context: str,
) -> TModel:
    """Extract YAML from raw LLM output and validate against a Pydantic model."""
    try:
        block = extract_yaml_block(raw)
        data = parse_yaml_strict(block, expected_root_type=dict)
        return model.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"{context}: invalid LLM YAML schema: {e}") from e

import logging
import os
from typing import Any, Dict

from openai import OpenAI
from PIL import Image

from app.config import get_settings
from app.utils.llm_utils import (
    encode_pil_image,
    parse_yaml,
    process_pdf,
    sanitize_llm_output,
)

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_system_instruction(system_instruction_path):
    """
    Get the system instruction (.md or .txt) from the file at the given path.

    Args:
        system_instruction_path (str): The path to the file containing the system instruction.

    Returns:
        str: The system instruction.
    """
    try:
        with open(system_instruction_path, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        raise FileNotFoundError(
            f"System instruction file not found at {system_instruction_path}"
        )


def _build_message(system_instruction_path, data_path=None, prompt=None):
    """
    Build a message object for the OpenAI API.

    Args:
        prompt (str): The prompt to include in the message.
        data (str): The data to include in the message.

    Returns:
        dict: The message object.
    """
    messages: list[dict[str, str | list[dict[str, str | dict[str, str]]] | None]] = [
        {"role": "system", "content": None},
        {"role": "user", "content": []},
    ]
    user_content = []

    system_instruction = _get_system_instruction(system_instruction_path)
    messages[0]["content"] = system_instruction

    if data_path:
        if (
            data_path.endswith(".jpg")
            or data_path.endswith(".png")
            or data_path.endswith(".jpeg")
        ):
            pil_image = Image.open(data_path)
            image_uri = encode_pil_image(pil_image)
            user_content.append({"type": "image_url", "image_url": {"url": image_uri}})

        if data_path.endswith(".pdf"):
            pdf_uri_list = process_pdf(data_path)
            messages[1]["content"] = [{}]
            for image_uri in pdf_uri_list:
                user_content.append(
                    {"type": "image_url", "image_url": {"url": image_uri}}
                )

    # append prompt
    if prompt:
        user_content.append({"type": "text", "text": prompt})

    # assemble the message payload
    messages[1]["content"] = user_content
    return messages


# ========= services =========
def call_model(
    model_id, system_instruction_path, data_path=None, prompt=None, usage_summary=None
):
    """
    Call the model API with the given parameters.

    Args:
        model_id (str): The ID of the model to use.
        system_instruction_path (str): The path to the system instruction file.
        data_path (str, optional): The path to the data file. Defaults to None.
        prompt (str, optional): The prompt to use. Defaults to None.

    Returns:
        str: The response from the model.
    """
    # build message payload
    messages = _build_message(
        system_instruction_path,
        data_path=data_path,
        prompt=prompt,
    )

    # OpenAI-api-compatible AWS API calling functions
    client = OpenAI(
        api_key=settings.aws_bedrock_api_key.get_secret_value(),
        base_url=settings.bedrock_base_url,
    )

    logger.info("Invoking model API")
    try:
        completion = client.chat.completions.create(
            model=model_id,
            messages=messages,
            max_completion_tokens=settings.max_output_tokens,
            temperature=settings.temperature,
            top_p=settings.top_p,
        )
    except Exception as e:
        raise RuntimeError(f"Error invoking model API: {e}") from e

    if usage_summary:
        usage_summary = completion.usage
        logger.info(f"Usage Summary: {usage_summary}")

    logger.info("Model response received")
    return completion.choices[0].message.content


def model_parse_document(file_path: str) -> Dict[str, Any]:
    """
    Parse a receipt document (image or PDF) using the Vision Language Model (VLM).

    Supports the same file types accepted by ``_build_message``: ``.jpg``,
    ``.jpeg``, ``.png``, and ``.pdf``.

    Args:
        file_path (str): Path to the image or PDF file.

    Returns:
        Dict[str, Any]: Parsed content from the document.
    """
    try:
        response = call_model(
            settings.vlm_model_id,
            settings.receipt_parsing_instruction_path,
            data_path=file_path,
        )
    except Exception as e:
        raise ValueError(
            f"(!) Error invoking model API for document parsing: {e}"
        ) from e

    if response:
        sanitized_content = sanitize_llm_output(response)
        parsed_content = parse_yaml(sanitized_content)
        return parsed_content
    else:
        return {}


# Backwards-compatible aliases — prefer model_parse_document for new call sites.
model_parse_image = model_parse_document
model_parse_pdf = model_parse_document


def model_categorize_transaction(transaction_content) -> Dict[str, Any]:
    """
    Categorize a transaction based on its content using LLM.

    Args:
        transaction_content (Dict[str, Any]): Parsed content from the transaction.

    Returns:
        Dict[str, Any]: Categorized transaction type.
    """
    try:
        reponse = call_model(
            settings.vlm_model_id,
            settings.categorizing_instruction_path,
            prompt=str(transaction_content),
        )
    except Exception as e:
        raise ValueError(f"(!) Error invoking model API for categorization: {e}") from e

    if reponse:
        sanitized_content = sanitize_llm_output(reponse)
        parsed_content = parse_yaml(sanitized_content)
        return parsed_content
    else:
        return {}


def model_parse_bank_statement_metadata(file_path: str) -> Dict[str, Any]:
    """
    Parse a bank statement metadata using VLM.

    Args:
        file_path (str): Path to the bank statement file.

    Returns:
        Dict[str, Any]: Parsed metadata from the bank statement.
    """
    try:
        reponse = call_model(
            settings.vlm_model_id,
            settings.bankstatement_metadata_parsing_instruction_path,
            data_path=file_path,
        )
    except Exception as e:
        raise ValueError(
            f"(!) Error invoking model API for parsing bank statement: {e}"
        ) from e

    if reponse:
        sanitized_content = sanitize_llm_output(reponse)
        parsed_content = parse_yaml(sanitized_content)
        return parsed_content
    else:
        return {}


if __name__ == "__main__":
    from pprint import pprint

    PROMPT = "What is your knowledge cutoff date"
    IMAGE_PATH = "samples/receipts/receipt_1.jpg"
    PDF_PATH = "samples/receipts/receipt_9.pdf"
    BANK_STATEMENT_PATH = "samples/bank_statements/bank_statement_1.pdf"

    # fuse path with base directory
    IMAGE_PATH = os.path.join(settings.base_path, IMAGE_PATH)
    PDF_PATH = os.path.join(settings.base_path, PDF_PATH)
    BANK_STATEMENT_PATH = os.path.join(settings.base_path, BANK_STATEMENT_PATH)

    # # test vlm parse image
    # transaction_content = model_parse_image(IMAGE_PATH)
    # pprint(transaction_content)
    # # get cat
    # expense_type = model_categorize_transaction(transaction_content)
    # pprint(expense_type)

    # # test vlm parse pdf
    # transaction_content = model_parse_pdf(PDF_PATH)
    # pprint(transaction_content)
    # # get cat
    # expense_type = model_categorize_transaction(transaction_content)
    # pprint(expense_type)

    # test bankstatement metadata parsing
    metadata = model_parse_bank_statement_metadata(BANK_STATEMENT_PATH)
    pprint(metadata)

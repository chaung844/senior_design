import os
import sys

from openai import OpenAI

from app.config import get_settings
from app.utils.llm_utils import (
    encode_pil_image,
    parse_yaml,
    process_pdf,
    sanitize_llm_output,
)

# =======  get settings =======
settings = get_settings()


# ======= local functions =======
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
        print(f"(!) System instruction file not found at {system_instruction_path}")
        sys.exit(1)


def _build_message(system_instruction_path, data_path=None, prompt=None):
    """
    Build a message object for the OpenAI API.

    Args:
        prompt (str): The prompt to include in the message.
        data (str): The data to include in the message.

    Returns:
        dict: The message object.
    """
    messages = [{"role": "system", "content": None}, {"role": "user", "content": []}]
    user_content = []

    # get the system instruction string
    try:
        system_instruction = _get_system_instruction(system_instruction_path)
        messages[0]["content"] = system_instruction
    except FileNotFoundError:
        print(f"(!) System instruction file not found at {system_instruction_path}")
        sys.exit(1)

    if data_path:
        # append single image data
        # check file extension for data type
        if (
            data_path.endswith(".jpg")
            or data_path.endswith(".png")
            or data_path.endswith(".jpeg")
        ):
            try:
                image_uri = encode_pil_image(data_path)
                user_content.append(
                    {"type": "image_url", "image_url": {"url": image_uri}}
                )
            except FileNotFoundError:
                print(f"(!) Image file not found at {data_path}")
                sys.exit(1)

        # append pdf data
        if data_path.endswith(".pdf"):
            try:
                pdf_uri_list = process_pdf(data_path)
                messages[1]["content"] = [{}]
                for image_uri in pdf_uri_list:
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": image_uri}}
                    )
            except FileNotFoundError:
                print(f"(!) PDF file not found at {data_path}")
                sys.exit(1)

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

    print("(*) Invoking model API: ")
    try:
        completion = client.chat.completions.create(
            model=model_id,
            messages=messages,
            max_completion_tokens=settings.max_output_tokens,
            temperature=settings.temperature,
            top_p=settings.top_p,
        )
    except Exception as e:
        print(f"(!) Error invoking model API: {e}")
        return None

    # Handle the response
    if usage_summary:
        usage_summary = completion.usage
        print(f"(*) Usage Summary: {usage_summary}\n")

    print("(*) Agent response: ")
    return completion.choices[0].message.content


if __name__ == "__main__":
    from pprint import pprint

    PROMPT = "What is your knowledge cutoff date"
    IMAGE_PATH = "samples/receipts/receipt_1.jpg"
    PDF_PATH = "samples/receipts/receipt_9.pdf"

    # fuse path with base directory
    IMAGE_PATH = os.path.join(settings.base_path, IMAGE_PATH)
    PDF_PATH = os.path.join(settings.base_path, PDF_PATH)

    # get parsed receipt content
    receipt_content = call_model(
        settings.model_id,
        settings.receipt_parsing_instruction_path,
        data_path=PDF_PATH,
    )
    receipt_content = sanitize_llm_output(receipt_content)
    print(receipt_content)
    print("=== END OF RESPONSE ===")

    # get expense type
    expense_type = call_model(
        settings.model_id,
        settings.categorizing_instruction_path,
        prompt=receipt_content,
    )
    expense_type = sanitize_llm_output(expense_type)
    print(expense_type)
    print("=== END OF RESPONSE ===")

    # Try parsing YAML content
    parsed_receipt_content_yaml = parse_yaml(receipt_content)
    parsed_expense_type_yaml = parse_yaml(expense_type)
    print("\n(*)Parsed yaml content:")

    pprint(parsed_receipt_content_yaml)
    print("(*) Expense type:")
    pprint(parsed_expense_type_yaml)

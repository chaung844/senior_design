import base64
import io
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from openai import OpenAI
from pdf2image import convert_from_path
from PIL import Image

from app.config import get_settings
from app.utils.llm_utils import parse_yaml, sanitize_llm_output

# get settings
settings = get_settings()


# helpers function
def _encode_image_file(image_path):
    """
    Encodes a local image file to a base64 Data URI, resizing and
    compressing it to stay within API payload limits.

    Args:
        image_path (str): Path to the local image file.

    Returns:
        str: Base64 Data URI of the image.
    """
    if not os.path.exists(image_path):
        print(f"(!) Error: Local file not found: {image_path}")
        sys.exit(1)

    try:
        img = Image.open(image_path)
        # Resize large images to fit within MAX_IMAGE_DIMENSION
        if (
            img.width > settings.max_image_dimension
            or img.height > settings.max_image_dimension
        ):
            img.thumbnail((settings.max_image_dimension, settings.max_image_dimension))
            print(f"(>) Resized image to {img.width}x{img.height}")
        # Convert to RGB if necessary (e.g. RGBA PNGs)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=settings.jpeg_quality)
        base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"(!) Error: Failed to encode image file: {image_path} — {e}")
        sys.exit(1)

    return f"data:image/jpeg;base64,{base64_image}"


def _encode_pil_image(pil_image):
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


def _process_pdf(pdf_path, max_pages=6, resize=True):
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
        print(f"(!) Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    print(f"(>) Processing PDF: {pdf_path} (Max {max_pages} pages)...")
    try:
        # Convert PDF to list of PIL images at a reduced DPI
        images = convert_from_path(
            pdf_path, dpi=settings.pdf_dpi, first_page=1, last_page=max_pages
        )
        print(f"(>) Extracted {len(images)} pages.")

        def _process_image_helper(img):
            # Resize if huge to avoid hitting payload / token limits
            if resize and (
                img.width > settings.max_image_dimension
                or img.height > settings.max_image_dimension
            ):
                img.thumbnail(
                    (settings.max_image_dimension, settings.max_image_dimension)
                )
            return _encode_pil_image(img)

        # Process images in parallel to speed up encoding and resizing
        with ThreadPoolExecutor() as executor:
            base64_images = list(executor.map(_process_image_helper, images))

        return base64_images
    except Exception as e:
        print(f"(!) Error converting PDF: {e}")
        print("    (Tip: Do you have 'poppler' installed on your system?)")
        sys.exit(1)


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
                image_uri = _encode_image_file(data_path)
                user_content.append(
                    {"type": "image_url", "image_url": {"url": image_uri}}
                )
            except FileNotFoundError:
                print(f"(!) Image file not found at {data_path}")
                sys.exit(1)

        # append pdf data
        if data_path.endswith(".pdf"):
            try:
                pdf_uri_list = _process_pdf(data_path)
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

    # OpenAI_API-like AWS API calling functions
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

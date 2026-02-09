import argparse
import base64
import io
import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
from openai import OpenAI
from pdf2image import convert_from_path

load_dotenv()


def encode_image_file(image_path):
    """
    Encodes a local image file to a base64 Data URI.

    Args:
        image_path (str): Path to the local image file.

    Returns:
        str: Base64 Data URI of the image.
    """
    if not os.path.exists(image_path):
        print(f"(!) Error: Local file not found: {image_path}")
        sys.exit(1)

    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        mime_type = "image/jpeg"

    with open(image_path, "rb") as image_file:
        base64_image = base64.b64encode(image_file.read()).decode("utf-8")

    return f"data:{mime_type};base64,{base64_image}"


def encode_pil_image(pil_image):
    """
    Encodes a PIL Image object (from pdf2image) to a base64 Data URI.

    Args:
        pil_image (PIL.Image): The PIL Image object to encode.

    Returns:
        str: Base64 Data URI of the image.
    """
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG")
    base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{base64_image}"


def process_pdf(pdf_path, max_pages=6, resize=False):
    """
    Converts PDF pages to base64 images, processing pages in parallel for performance.

    Args:
        pdf_path (str): Path to the PDF file.
        max_pages (int): Maximum number of pages to convert.
        resize (bool): Whether to resize large images to fit within 1024x1024.

    Returns:
        list: List of base64 Data URI strings for each page image.
    """
    if not os.path.exists(pdf_path):
        print(f"(!) Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    print(f"(>) Processing PDF: {pdf_path} (Max {max_pages} pages)...")
    try:
        # Convert PDF to list of PIL images
        images = convert_from_path(pdf_path, first_page=1, last_page=max_pages)
        print(f"(>) Extracted {len(images)} pages.")

        def _process_image_helper(img):
            # Resize if huge to avoid hitting token limits
            if resize and (img.width > 1024 or img.height > 1024):
                img.thumbnail((1024, 1024))
            return encode_pil_image(img)

        # Process images in parallel to speed up encoding and resizing
        with ThreadPoolExecutor() as executor:
            base64_images = list(executor.map(_process_image_helper, images))

        return base64_images
    except Exception as e:
        print(f"(!) Error converting PDF: {e}")
        print("    (Tip: Do you have 'poppler' installed on your system?)")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Test vLLM Inference Server on Modal")
    parser.add_argument(
        "--url",
        type=str,
        default="https://t-anhtiep114--demo-vllm-inference-serve.modal.run",
        help="The full Modal URL",
    )
    parser.add_argument("--key", type=str, help="Your VLLM_API_KEY")
    parser.add_argument(
        "--model",
        type=str,
        default="Qwen/Qwen3-VL-8B-Instruct-FP8",
        help="The model name",
    )
    parser.add_argument(
        "--prompt", type=str, default="Introduce yourself.", help="The text prompt"
    )
    parser.add_argument(
        "--prompt-file",
        type=str,
        help="Path to a text file containing the prompt (overrides --prompt)",
    )
    parser.add_argument("--image", type=str, help="URL OR Local Path of the image")
    parser.add_argument(
        "--pdf", type=str, help="Path to a PDF file to extract images from."
    )

    args = parser.parse_args()

    # --- Base URL Validation ---
    base_url = args.url
    if not base_url:
        print(" (!) Error: Missing URL.")
        sys.exit(1)
    if not base_url.endswith("/v1"):
        base_url = f"{base_url.rstrip('/')}/v1"

    print(f"(>) Connecting to: {base_url}")
    print(f"(>) Using Model: {args.model}")

    try:
        client = OpenAI(base_url=base_url, api_key="dummy")
    except Exception as e:
        print(f"(!) Failed to create client: {e}")
        sys.exit(1)

    # --- build multimodal user content ---
    # user_content = [{"type": "text", "text": args.prompt}]
    user_content = [{"type": "text", "text": ""}]

    # --- Image Source ---
    if args.image:
        if args.image.startswith("http"):
            img_data = args.image
        else:
            img_data = encode_image_file(args.image)

        user_content.append({"type": "image_url", "image_url": {"url": img_data}})

    # --- Load Prompt from File if Specified ---
    # if args.prompt_file:
    #     if not os.path.exists(args.prompt_file):
    #         print(f"(!) Error: Prompt file not found: {args.prompt_file}")
    #         sys.exit(1)

    #     try:
    #         with open(args.prompt_file, "r", encoding="utf-8") as f:
    #             args.prompt = f.read().strip()
    #         print(f"(>) Loaded prompt from: {args.prompt_file}")
    #     except Exception as e:
    #         print(f"(!) Error reading prompt file: {e}")
    #         sys.exit(1)

    # --- PDF loading and image extraction ---
    if args.pdf:
        pdf_images = process_pdf(args.pdf, max_pages=6, resize=False)
        for i, img_data in enumerate(pdf_images):
            print(f"    - Attaching PDF Page {i + 1}")
            user_content.append({"type": "image_url", "image_url": {"url": img_data}})

    # --- Send Request ---
    try:
        with open(
            "prompts/receipts_parsing_instruction.md", "r", encoding="utf-8"
        ) as f:
            system_instruction = f.read().strip()
    except Exception as e:
        print(f"(!) Error reading system instruction file: {e}")
        sys.exit(1)

    messages = [
        {
            "role": "system",
            "content": system_instruction,
        },
        {"role": "user", "content": user_content},
    ]

    print("\n--- Request Details ---")
    print(f"(*) System Instruction Loaded: {system_instruction[:100]}...")
    # print(
    #     f"\nUser Prompt: {args.prompt[:100]}..."
    #     if len(args.prompt) > 100
    #     else f"User Prompt: {args.prompt}"
    # )
    print(
        f"\n(*) Attached Images: {len(user_content) - 1}"
    )  # Subtract 1 for the text block
    print("\n(*) Assistant: \n", end="", flush=True)

    try:
        stream = client.chat.completions.create(
            model=args.model,
            messages=messages,
            stream=True,
            temperature=0.0,
            top_p=0.8,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=8096,
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content, end="", flush=True)
        print("\n")

    except Exception as e:
        print(f"\n\n(!) API Request Failed: {e}")


if __name__ == "__main__":
    main()

    """
    uv run test_client.py \
    --image "safe/sample/receipt_11.jpg" \
    --prompt-file "prompts/receipts_parsing_instruction.md"
    """

    """
    uv run test_client.py \
    --pdf "safe/sample/receipt_4.pdf" \
    --prompt-file "prompts/receipts_parsing_instruction.md"
    """

    """
    uv run test_client.py \
    --prompt "Explain Quantum Computing in soccer terms."
    """

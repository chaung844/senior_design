import re

import pandas as pd
import pdfplumber

"""
This is really messy. Need a re-eval of function name and tight pydantic validation.
"""


def sanitize_charge_amount(raw_content):
    """
    Sanitizes the charge amount by removing any non-numeric characters except for '.'.

    Args:
        raw_content: The raw content to be sanitized.

    Returns:
        A sanitized string representing the charge amount.
    """
    # Use regex to remove unwanted characters
    sanitized = re.sub(r"[^0-9.]", "", raw_content)

    # to number format
    try:
        float(sanitized)
    except ValueError:
        sanitized = "nan"
    return sanitized


def validate_bankstatement_pdf(path):
    """
    Validate a bank statement PDF file by checking its contents.

    Args:
      path: The path to the PDF file.

    Raises:
      ValueError: If the PDF is empty or contains only text.
      ValueError: If the PDF contains embedded images.

    Returns:
      None
    """
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) == 0:
            raise ValueError("Empty PDF")

        # Reject scanned PDFs
        text = pdf.pages[0].extract_text()
        if not text or len(text.strip()) < 100:
            raise ValueError("Likely scanned or image-only PDF")

        # # Optional: check for embedded images dominance
        # if len(pdf.pages[0].images) > 5:
        #     raise ValueError("Image-heavy PDF rejected")


def detect_bank(pdf):
    """
    Detect the bank in a PDF file by analyzing its first page.

    Args:
      pdf: The PDF object.

    Returns:
      A string representing the detected bank.
    """
    first_page_text = pdf.pages[0].extract_text()

    if "CHASE" in first_page_text:
        return "CHASE_V1"
    if "BANK OF AMERICA" in first_page_text:
        return "BOA_V1"

    raise ValueError("Unknown bank template")


def get_table1_bbox(page):
    text = page.extract_text()

    if "MCC" not in text:
        return None

    # Manually tuned bounding box per template
    return (15, 370, 590, 550)  # (x0, y0, x1, y1)


def get_table2_bbox(page):
    text = page.extract_text()

    if "MCC" not in text:
        return None

    # Manually tuned bounding box per template
    return (15, 85, 590, 790)  # (x0, y0, x1, y1)


def extract_transactions(pdf):
    """
    Extract transactions from a PDF file.

    Args:
        pdf (pdfplumber.pdf.PDF): PDF file to extract transactions from.

    Returns:
        list: List of extracted transactions.
    """
    transactions = []

    # Bank of America Pattern
    # transaction table in page 1 and 3
    for page in pdf.pages:
        print(f"(*) Processing page {page.page_number}")
        if get_table1_bbox(page) and page.page_number == 1:
            print(
                f"(*) Found transaction table in page {page.page_number} using table1_bbox"
            )
            bbox = get_table1_bbox(page)
            cropped = page.crop(bbox)
            extraced_text = cropped.extract_text()
            print(extraced_text[:100])
            transactions.append(extraced_text)
        elif get_table2_bbox(page) and page.page_number == 3:
            print(
                f"(*) Found transaction table in page {page.page_number} using table2_bbox"
            )
            bbox = get_table2_bbox(page)
            cropped = page.crop(bbox)
            extraced_text = cropped.extract_text()
            print(extraced_text[:100])
            transactions.append(extraced_text)
        else:
            continue
    return transactions


def parse_statement(path) -> pd.DataFrame:
    """
    Parse a statement PDF and return a DataFrame.

    Args:
        path (str): Path to the PDF file.

    Returns:
        DataFrame: DataFrame containing the parsed transactions.
    """
    validate_bankstatement_pdf(path)

    with pdfplumber.open(path) as pdf:
        # bank = detect_bank(pdf)

        # if bank == "BOA_V1":
        #     settings = CHASE_TABLE_SETTINGS
        # else:
        #     raise ValueError("Unsupported bank")
        # settings = 2
        raw_rows = extract_transactions(pdf)

        # txns = [parse_row(r) for r in raw_rows if r[0] != "Date"]
        # validate_transactions(txns)

        # return raw_rows

    raw_text = "\n ".join(raw_rows)

    # clean and split the text into individual lines
    lines = raw_text.strip().split("\n")
    data_rows = []

    # iterate through lines to parse them to a struct. TODO: should parse to a pydantic model or something
    for line in lines:
        line = line.strip()

        # If line does not start with a number then skip
        if not line or not line[0].isdigit():
            continue
        # Split the line by whitespace
        parts = line.split()

        # Validation: Ensure we have enough columns
        # Minimum required: 2 dates + 1 description + 1 ref + 1 mcc + 1 charge = 6 items
        if len(parts) >= 6:
            # Index Mapping:
            # 0: Posting Date
            # 1: Transaction Date
            # 2 to len-3: Description (join the middle parts)
            # len-3: Reference Number
            # len-2: MCC
            # len-1: Charge

            row = {
                "posting_date": parts[0],
                "transaction_date": parts[1],
                "description": " ".join(parts[2:-3]),
                "reference": parts[-3].strip(),
                "mcc": parts[-2].strip(),
                "charge": sanitize_charge_amount(parts[-1].strip()),
            }
            data_rows.append(row)

    # to dataframe
    df = pd.DataFrame(data_rows)

    # # Optional: Convert date columns to datetime objects for better manipulation
    # df['posting_date'] = pd.to_datetime(df['posting_date'])
    # df['transaction_date'] = pd.to_datetime(df['transaction_date'])

    # Display the result
    # print(df.to_string(index=False))
    # print(len(df))

    return df


if __name__ == "__main__":
    # sample
    result_df: pd.DataFrame = parse_statement(
        "safe/samples/bank_statements/bank_statement_1.pdf"
    )
    print(result_df.to_string(index=False))

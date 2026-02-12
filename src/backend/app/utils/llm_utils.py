import re

import yaml


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
        dict: The parsed YAML content.
    """
    try:
        return yaml.safe_load(content)
    except yaml.YAMLError as e:
        raise ValueError(f"Failed to parse YAML: {e}")

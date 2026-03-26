"""Strict YAML -> Pydantic validation for LLM outputs."""

from decimal import Decimal

import pytest

from app.schemas.llm_parsed_models import ReceiptParsingYAML
from app.utils.llm_utils import parse_yaml_to_model


def test_valid_receipt_yaml_in_fence() -> None:
    raw = """```yaml
vendor: Acme
date: 2024-01-15
total: 12.99
purchase_desc: Office supplies
```"""
    m = parse_yaml_to_model(raw, ReceiptParsingYAML, context="test")
    assert m.vendor == "Acme"
    assert m.date.isoformat() == "2024-01-15"
    assert m.total == Decimal("12.99")


def test_valid_receipt_yaml_raw() -> None:
    raw = "vendor: X\ndate: 2024-06-01\ntotal: '1.00'\n"
    m = parse_yaml_to_model(raw, ReceiptParsingYAML, context="test")
    assert m.vendor == "X"
    assert m.total == Decimal("1.00")


def test_missing_required_vendor_raises() -> None:
    raw = "date: 2024-01-01\ntotal: 10.00\n"
    with pytest.raises(ValueError):
        parse_yaml_to_model(raw, ReceiptParsingYAML, context="receipt_parse")


def test_invalid_total_raises() -> None:
    raw = "vendor: Shop\ndate: 2024-01-01\ntotal: ten dollars\n"
    with pytest.raises(ValueError):
        parse_yaml_to_model(raw, ReceiptParsingYAML, context="test")

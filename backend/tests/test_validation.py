import pytest
import pandas as pd
from fastapi import HTTPException
from app.services.validation import parse_and_validate_file

def test_parse_csv_success():
    csv_content = b"email,name,role\ntest@example.com,Test User,Admin\n"
    df = parse_and_validate_file(csv_content, "recipients.csv")
    assert len(df) == 1
    assert "email" in df.columns
    assert "name" in df.columns
    assert df.iloc[0]["email"] == "test@example.com"

def test_parse_drops_empty_rows():
    csv_content = b"email,name\ntest@example.com,Test User\n,\n,\n"
    df = parse_and_validate_file(csv_content, "recipients.csv")
    assert len(df) == 1

def test_parse_invalid_extension():
    with pytest.raises(HTTPException):
        parse_and_validate_file(b"some content", "recipients.txt")

def test_parse_cleans_column_names():
    csv_content = b"  email  , name \ntest@example.com,Test User\n"
    df = parse_and_validate_file(csv_content, "recipients.csv")
    assert "email" in df.columns
    assert "name" in df.columns
    assert "  email  " not in df.columns

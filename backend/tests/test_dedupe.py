from app.services.dedupe import deduplicate_recipients

def test_deduplicate_removes_exact_duplicates():
    records = [
        {"email": "test@example.com", "name": "A"},
        {"email": "test@example.com", "name": "B"},
        {"email": "other@example.com", "name": "C"}
    ]
    result = deduplicate_recipients(records, "email")
    assert len(result) == 2
    assert result[0]["name"] == "A"
    assert result[1]["name"] == "C"

def test_deduplicate_handles_case_and_whitespace():
    records = [
        {"email": "test@example.com"},
        {"email": " TEST@example.com "},
        {"email": "Test@Example.com"}
    ]
    result = deduplicate_recipients(records, "email")
    assert len(result) == 1
    assert result[0]["email"] == "test@example.com"

def test_deduplicate_ignores_missing_emails():
    records = [
        {"email": "test@example.com"},
        {"email": ""},
        {"name": "No Email"},
        {"email": "other@example.com"}
    ]
    result = deduplicate_recipients(records, "email")
    assert len(result) == 2

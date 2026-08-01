from typing import List, Dict, Any

def deduplicate_recipients(records: List[Dict[str, Any]], email_col: str) -> List[Dict[str, Any]]:
    """
    Removes duplicate recipients based on their email address.
    Handles case differences and trailing whitespace.
    """
    seen_emails = set()
    deduped_records = []
    
    for record in records:
        if email_col not in record or not record[email_col]:
            continue
            
        # Clean email: lowercase and strip whitespace
        raw_email = str(record[email_col])
        clean_email = raw_email.strip().lower()
        
        if not clean_email:
            continue
            
        if clean_email not in seen_emails:
            seen_emails.add(clean_email)
            # Optionally update the record with the cleaned email
            record[email_col] = clean_email
            deduped_records.append(record)
            
    return deduped_records

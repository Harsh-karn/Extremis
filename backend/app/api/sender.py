from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import smtplib
from email.message import EmailMessage
import pandas as pd
import io
import re

router = APIRouter()

@router.post("/parse-csv")
async def parse_csv(file: UploadFile = File(...)):
    content = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        columns = df.columns.tolist()
        all_rows = df.fillna("").to_dict(orient='records')
        preview = all_rows[:5]
        
        return {
            "columns": columns,
            "preview": preview,
            "all_rows": all_rows,
            "total_rows": len(df),
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


class SendEmailRequest(BaseModel):
    gmail_email: str
    gmail_app_password: str
    subject_template: str
    body_template: str
    recipients: list[dict]
    email_column: str

@router.post("/send")
async def send_emails(payload: SendEmailRequest):
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(payload.gmail_email, payload.gmail_app_password)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Failed to authenticate with Gmail: {str(e)}")

    results = []
    
    for row in payload.recipients:
        target_email = row.get(payload.email_column)
        if not target_email:
            continue
            
        # Replace variables
        subject = payload.subject_template
        body = payload.body_template
        
        for key, value in row.items():
            pattern = r'\{\{\s*' + re.escape(str(key)) + r'\s*\}\}'
            subject = re.sub(pattern, str(value), subject, flags=re.IGNORECASE)
            body = re.sub(pattern, str(value), body, flags=re.IGNORECASE)

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = payload.gmail_email
        msg["To"] = target_email
        msg.set_content(body)

        try:
            server.send_message(msg)
            results.append({"email": target_email, "status": "success"})
        except Exception as e:
            results.append({"email": target_email, "status": "failed", "error": str(e)})

    server.quit()
    return {"message": f"Sent {len(results)} emails", "results": results}

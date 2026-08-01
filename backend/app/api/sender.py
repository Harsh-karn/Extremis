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
            
        df.columns = [str(c) for c in df.columns]
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

from fastapi.responses import StreamingResponse
import json

@router.post("/send")
async def send_emails(payload: SendEmailRequest):
    def email_generator():
        try:
            # Clean credentials (Google app passwords often get copied with non-breaking spaces)
            clean_email = payload.gmail_email.strip()
            clean_password = payload.gmail_app_password.replace('\\xa0', '').replace(' ', '').strip()
            
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(clean_email, clean_password)
        except Exception as e:
            yield json.dumps({"error": f"Failed to authenticate with Gmail: {str(e)}"}) + "\n"
            return

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
                yield json.dumps({"email": target_email, "status": "success"}) + "\n"
            except Exception as e:
                yield json.dumps({"email": target_email, "status": "failed", "error": str(e)}) + "\n"

        server.quit()

    return StreamingResponse(email_generator(), media_type="application/x-ndjson")

from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Depends
from pydantic import BaseModel
import smtplib
from email.message import EmailMessage
import pandas as pd
import io
import re
import time
import logging
from ..core.security import get_api_key
from ..core.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_api_key)])

@router.post("/parse-csv")
@limiter.limit("20/minute")
async def parse_csv(request: Request, file: UploadFile = File(...)):
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
        logger.error(f"File parsing failed: {e}")
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
@limiter.limit("5/minute")
async def send_emails(request: Request, payload: SendEmailRequest):
    def email_generator():
        try:
            # Clean credentials (Google app passwords often get copied with non-breaking spaces)
            clean_email = payload.gmail_email.strip()
            clean_password = payload.gmail_app_password.replace('\\xa0', '').replace(' ', '').strip()
            
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(clean_email, clean_password)
        except Exception as e:
            logger.error(f"Gmail authentication failed for {payload.gmail_email}: {e}")
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
                logger.info(f"Email sent successfully to {target_email}")
                yield json.dumps({"email": target_email, "status": "success"}) + "\n"
            except Exception as e:
                logger.error(f"Failed to send email to {target_email}: {e}")
                yield json.dumps({"email": target_email, "status": "failed", "error": str(e)}) + "\n"
            
            # Simple delay to avoid tripping spam filters too quickly
            time.sleep(1)

        server.quit()

    return StreamingResponse(email_generator(), media_type="application/x-ndjson")

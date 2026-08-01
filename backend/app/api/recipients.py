from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd
import io
import uuid
from typing import List, Dict, Any
from ..models.database import get_db
from ..models.models import RecipientList, Recipient, User
from ..services.validation import parse_and_validate_file
from ..services.dedupe import deduplicate_recipients

router = APIRouter()

class CreateListRequest(BaseModel):
    user_id: str = None
    name: str
    source_filename: str
    column_map: Dict[str, str]
    records: List[Dict[str, Any]]

@router.post("/upload")
async def upload_recipients_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    df = parse_and_validate_file(content, file.filename)
    
    columns = df.columns.tolist()
    preview = df.head(5).fillna("").to_dict(orient='records')
    
    return {
        "filename": file.filename, 
        "columns": columns, 
        "preview": preview,
        "total_rows": len(df)
    }

@router.post("/lists")
def create_recipient_list(payload: CreateListRequest, db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(payload.user_id) if payload.user_id else None
        
        new_list = RecipientList(
            user_id=user_id,
            name=payload.name,
            source_filename=payload.source_filename,
            column_map=payload.column_map
        )
        db.add(new_list)
        db.flush()
        
        email_col = payload.column_map.get("email")
        if email_col:
            unique_records = deduplicate_recipients(payload.records, email_col)
        else:
            unique_records = payload.records
        
        for record in unique_records:
            if not email_col or email_col not in record or not record[email_col]:
                continue
                
            email = record[email_col]
            name = record.get(payload.column_map.get("name"), "")
            company = record.get(payload.column_map.get("company"), "")
            role = record.get(payload.column_map.get("role"), "")
            
            custom_fields = {k: v for k, v in record.items() if k not in payload.column_map.values()}
            
            recipient = Recipient(
                list_id=new_list.id,
                name=str(name),
                email=str(email),
                company=str(company) if company else None,
                role=str(role) if role else None,
                custom_fields=custom_fields
            )
            db.add(recipient)
            
        db.commit()
        return {"id": str(new_list.id), "message": "List created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lists/{list_id}")
def get_list_metadata(list_id: str, db: Session = Depends(get_db)):
    r_list = db.query(RecipientList).filter(RecipientList.id == list_id).first()
    if not r_list:
        raise HTTPException(status_code=404, detail="List not found")
    return {
        "id": str(r_list.id), 
        "name": r_list.name,
        "source_filename": r_list.source_filename,
        "created_at": r_list.created_at
    }

@router.get("/lists/{list_id}/recipients")
def get_recipients(list_id: str, db: Session = Depends(get_db)):
    recipients = db.query(Recipient).filter(Recipient.list_id == list_id).all()
    return {"recipients": [
        {
            "id": str(r.id),
            "name": r.name,
            "email": r.email,
            "company": r.company,
            "role": r.role,
            "status": r.status.value
        } for r in recipients
    ]}

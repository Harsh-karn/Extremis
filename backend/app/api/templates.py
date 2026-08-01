from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from ..models.database import get_db
from ..models.models import Template

router = APIRouter()

class TemplateCreate(BaseModel):
    user_id: str = None
    name: str
    category: str = None
    subject: str
    body_html: str = None
    body_markdown: str = None

@router.get("/")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(Template).all()
    return [{"id": str(t.id), "name": t.name, "category": t.category, "subject": t.subject} for t in templates]

@router.post("/")
def create_template(payload: TemplateCreate, db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(payload.user_id) if payload.user_id else None
        template = Template(
            user_id=user_id,
            name=payload.name,
            category=payload.category,
            subject=payload.subject,
            body_html=payload.body_html,
            body_markdown=payload.body_markdown
        )
        db.add(template)
        db.commit()
        return {"id": str(template.id), "message": "Template created"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{template_id}")
def update_template(template_id: str, payload: TemplateCreate, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    try:
        template.name = payload.name
        template.category = payload.category
        template.subject = payload.subject
        template.body_html = payload.body_html
        template.body_markdown = payload.body_markdown
        db.commit()
        return {"message": "Template updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        db.delete(template)
        db.commit()
        return {"message": "Template deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

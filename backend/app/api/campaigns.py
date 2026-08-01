from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import uuid
import re
from typing import List, Dict, Any, Optional
from ..models.database import get_db
from ..models.models import Campaign, CampaignStatus, Template, RecipientList, Recipient, ProviderConfig, EmailLog
from ..workers.tasks import send_email_task

router = APIRouter()

class CampaignCreate(BaseModel):
    user_id: str = None
    name: str
    template_id: str
    recipient_list_id: str
    provider_config_id: str
    delay_min_seconds: int = 0
    delay_max_seconds: int = 0

def render_template(template_str: str, recipient: Recipient) -> str:
    if not template_str:
        return ""
    
    rendered = template_str
    
    fields = {
        "name": recipient.name,
        "email": recipient.email,
        "company": recipient.company or "",
        "role": recipient.role or ""
    }
    if recipient.custom_fields:
        fields.update(recipient.custom_fields)
        
    for key, value in fields.items():
        pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
        rendered = re.sub(pattern, str(value), rendered, flags=re.IGNORECASE)
        
    return rendered

@router.post("/")
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(payload.user_id) if payload.user_id else None
        
        campaign = Campaign(
            user_id=user_id,
            name=payload.name,
            template_id=uuid.UUID(payload.template_id),
            recipient_list_id=uuid.UUID(payload.recipient_list_id),
            provider_config_id=uuid.UUID(payload.provider_config_id),
            delay_min_seconds=payload.delay_min_seconds,
            delay_max_seconds=payload.delay_max_seconds,
            status=CampaignStatus.draft
        )
        db.add(campaign)
        db.commit()
        return {"id": str(campaign.id), "message": "Campaign created"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{campaign_id}/preview")
def preview_campaign(campaign_id: str, db: Session = Depends(get_db), limit: int = 5):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    recipients = db.query(Recipient).filter(Recipient.list_id == campaign.recipient_list_id).limit(limit).all()
    
    previews = []
    for r in recipients:
        subject = render_template(campaign.template.subject, r)
        body = render_template(campaign.template.body_html or campaign.template.body_markdown, r)
        
        previews.append({
            "recipient_id": str(r.id),
            "recipient_email": r.email,
            "subject": subject,
            "body": body
        })
        
    return {"previews": previews}

@router.post("/{campaign_id}/start")
def start_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status in [CampaignStatus.sending, CampaignStatus.completed]:
        raise HTTPException(status_code=400, detail="Campaign is already running or completed")
        
    campaign.status = CampaignStatus.sending
    db.commit()
    
    recipients = db.query(Recipient).filter(
        Recipient.list_id == campaign.recipient_list_id,
        Recipient.status == 'pending'
    ).all()
    
    for r in recipients:
        subject = render_template(campaign.template.subject, r)
        body_html = render_template(campaign.template.body_html, r)
        body_txt = render_template(campaign.template.body_markdown, r)
        
        send_email_task.delay(
            recipient_id=str(r.id),
            campaign_id=str(campaign.id),
            provider_config_id=str(campaign.provider_config_id),
            rendered_subject=subject,
            rendered_body_html=body_html,
            rendered_body_txt=body_txt,
            delay_min=campaign.delay_min_seconds,
            delay_max=campaign.delay_max_seconds
        )
        
    return {"message": f"Started sending {len(recipients)} emails"}

@router.get("/{campaign_id}/status")
def campaign_status(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    total = db.query(func.count(Recipient.id)).filter(Recipient.list_id == campaign.recipient_list_id).scalar()
    sent = db.query(func.count(Recipient.id)).filter(Recipient.list_id == campaign.recipient_list_id, Recipient.status == 'sent').scalar()
    failed = db.query(func.count(Recipient.id)).filter(Recipient.list_id == campaign.recipient_list_id, Recipient.status == 'failed').scalar()
    
    success_rate = (sent / total * 100) if total > 0 else 0
    
    if sent + failed == total and total > 0 and campaign.status == CampaignStatus.sending:
        campaign.status = CampaignStatus.completed
        db.commit()
        
    return {
        "status": campaign.status.value, 
        "total": total,
        "sent": sent, 
        "pending": total - sent - failed, 
        "failed": failed, 
        "success_rate": round(success_rate, 2)
    }

@router.post("/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign:
        campaign.status = CampaignStatus.paused
        db.commit()
    return {"message": "Campaign paused"}

@router.post("/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign:
        campaign.status = CampaignStatus.sending
        db.commit()
    return {"message": "Campaign resumed"}

@router.post("/{campaign_id}/cancel")
def cancel_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign:
        campaign.status = CampaignStatus.cancelled
        db.commit()
    return {"message": "Campaign cancelled"}

@router.get("/")
def get_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    return [{"id": str(c.id), "name": c.name, "status": c.status.value} for c in campaigns]

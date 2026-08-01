from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.database import get_db
from ..models.models import Campaign, CampaignStatus, Recipient, RecipientStatus, EmailLog, EmailLogStatus

router = APIRouter()

@router.get("/")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_campaigns = db.query(Campaign).count()
    total_recipients = db.query(Recipient).count()
    
    # Calculate delivery rate based on email logs
    total_logs = db.query(EmailLog).count()
    sent_logs = db.query(EmailLog).filter(EmailLog.status == EmailLogStatus.sent).count()
    failed_logs = db.query(EmailLog).filter(EmailLog.status == EmailLogStatus.failed).count()
    
    delivery_rate = 0
    if total_logs > 0:
        delivery_rate = round((sent_logs / total_logs) * 100, 1)
        
    recent_campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).limit(3).all()
    recent_data = []
    
    for c in recent_campaigns:
        # Get count of recipients for this campaign's list
        rec_count = db.query(Recipient).filter(Recipient.list_id == c.list_id).count()
        recent_data.append({
            "id": str(c.id),
            "name": c.name,
            "status": c.status.value,
            "recipient_count": rec_count,
            "created_at": c.created_at
        })

    return {
        "total_campaigns": total_campaigns,
        "total_recipients": total_recipients,
        "delivery_rate": delivery_rate,
        "total_failed": failed_logs,
        "recent_campaigns": recent_data
    }

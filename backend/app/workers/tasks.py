import time
import random
from typing import Dict, Any
from ..core.celery_app import celery_app
from ..providers import get_provider_adapter
from ..models.database import SessionLocal
from ..models.models import EmailLog, EmailLogStatus, Recipient, RecipientStatus

@celery_app.task(bind=True, max_retries=3)
def send_email_task(self, recipient_id: str, campaign_id: str, provider_config_id: str, rendered_subject: str, rendered_body_html: str, rendered_body_txt: str, delay_min: int, delay_max: int):
    # Apply random delay before sending
    if delay_max > 0:
        delay = random.uniform(delay_min, delay_max)
        time.sleep(delay)

    db = SessionLocal()
    try:
        recipient = db.query(Recipient).filter(Recipient.id == recipient_id).first()
        if not recipient:
            return "Recipient not found"
        
        # Idempotency check: Don't double-send if retried
        if recipient.status in [RecipientStatus.sent, RecipientStatus.skipped]:
            return "Already processed"
            
        adapter = get_provider_adapter(provider_config_id, db)
        
        try:
            result = adapter.send_email(
                to_email=recipient.email,
                subject=rendered_subject,
                body_html=rendered_body_html,
                body_txt=rendered_body_txt
            )
            
            # Update recipient status
            recipient.status = RecipientStatus.sent
            
            # Create email log
            log = EmailLog(
                campaign_id=campaign_id,
                recipient_id=recipient_id,
                rendered_subject=rendered_subject,
                status=EmailLogStatus.sent,
                provider_message_id=result.get("message_id")
            )
            db.add(log)
            db.commit()
            return f"Sent to {recipient.email}"
            
        except ConnectionError as e:
            # Transient error, should retry
            recipient.status = RecipientStatus.failed
            log = EmailLog(
                campaign_id=campaign_id,
                recipient_id=recipient_id,
                rendered_subject=rendered_subject,
                status=EmailLogStatus.failed,
                error_message=str(e),
                retry_count=self.request.retries
            )
            db.add(log)
            db.commit()
            
            # Exponential backoff retry
            raise self.retry(exc=e, countdown=2 ** self.request.retries * 60)
            
        except ValueError as e:
            # Permanent error (auth failure, invalid recipient)
            recipient.status = RecipientStatus.failed
            log = EmailLog(
                campaign_id=campaign_id,
                recipient_id=recipient_id,
                rendered_subject=rendered_subject,
                status=EmailLogStatus.failed,
                error_message=str(e),
                retry_count=self.request.retries
            )
            db.add(log)
            db.commit()
            return f"Failed permanently: {str(e)}"
            
        except Exception as e:
            # Unexpected error, fail permanently for safety
            recipient.status = RecipientStatus.failed
            log = EmailLog(
                campaign_id=campaign_id,
                recipient_id=recipient_id,
                rendered_subject=rendered_subject,
                status=EmailLogStatus.failed,
                error_message=str(e),
                retry_count=self.request.retries
            )
            db.add(log)
            db.commit()
            return f"Failed unexpectedly: {str(e)}"
            
    finally:
        db.close()

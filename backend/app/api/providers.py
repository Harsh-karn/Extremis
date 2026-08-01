from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from ..models.database import get_db
from ..models.models import ProviderConfig, ProviderType
from ..providers import get_provider_adapter

router = APIRouter()

class ProviderCreate(BaseModel):
    user_id: str = None
    provider_type: str
    display_name: str
    credentials: str

@router.get("/")
def list_providers(db: Session = Depends(get_db)):
    providers = db.query(ProviderConfig).all()
    return [{"id": str(p.id), "display_name": p.display_name, "provider_type": p.provider_type.value, "is_active": p.is_active} for p in providers]

@router.post("/")
def add_provider(payload: ProviderCreate, db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(payload.user_id) if payload.user_id else None
        provider = ProviderConfig(
            user_id=user_id,
            provider_type=ProviderType(payload.provider_type),
            display_name=payload.display_name,
            credentials_encrypted=payload.credentials.encode('utf-8') 
        )
        db.add(provider)
        db.commit()
        return {"id": str(provider.id), "message": "Provider added"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{provider_id}/test")
def test_provider(provider_id: str, payload: dict, db: Session = Depends(get_db)):
    to_email = payload.get("to_email", "test@example.com")
    try:
        adapter = get_provider_adapter(provider_id, db)
        result = adapter.send_email(
            to_email=to_email,
            subject="MailForge Test Email",
            body_html="<p>This is a test from MailForge.</p>",
            body_txt="This is a test from MailForge."
        )
        return {"message": "Test email sent", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")

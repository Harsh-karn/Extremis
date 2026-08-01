from sqlalchemy.orm import Session
from ..models.models import ProviderConfig, ProviderType
from .base import BaseProviderAdapter
from .smtp_provider import SMTPAdapter

def get_provider_adapter(provider_config_id: str, db: Session) -> BaseProviderAdapter:
    config = db.query(ProviderConfig).filter(ProviderConfig.id == provider_config_id).first()
    if not config:
        raise ValueError("Provider configuration not found")
        
    if config.provider_type == ProviderType.smtp:
        return SMTPAdapter(config)
    
    return SMTPAdapter(config) # fallback

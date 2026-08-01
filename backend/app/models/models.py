from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime, Text, Enum, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from .database import Base

class ProviderType(str, enum.Enum):
    smtp = "smtp"
    gmail_oauth = "gmail_oauth"
    outlook_oauth = "outlook_oauth"
    ses = "ses"
    sendgrid = "sendgrid"
    mailgun = "mailgun"
    resend = "resend"

class RecipientStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"

class EmailLogStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    bounced = "bounced"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    providers = relationship("ProviderConfig", back_populates="user")
    lists = relationship("RecipientList", back_populates="user")
    templates = relationship("Template", back_populates="user")
    campaigns = relationship("Campaign", back_populates="user")

class ProviderConfig(Base):
    __tablename__ = "provider_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    provider_type = Column(Enum(ProviderType), nullable=False)
    display_name = Column(String, nullable=False)
    credentials_encrypted = Column(LargeBinary, nullable=False)
    daily_limit = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="providers")

class RecipientList(Base):
    __tablename__ = "recipient_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=False)
    source_filename = Column(String, nullable=False)
    column_map = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="lists")
    recipients = relationship("Recipient", back_populates="recipient_list", cascade="all, delete-orphan")

class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_id = Column(UUID(as_uuid=True), ForeignKey("recipient_lists.id"))
    name = Column(String, nullable=False)
    email = Column(String, index=True, nullable=False)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    custom_fields = Column(JSONB, nullable=True)
    is_duplicate = Column(Boolean, default=False)
    status = Column(Enum(RecipientStatus), default=RecipientStatus.pending)

    recipient_list = relationship("RecipientList", back_populates="recipients")

class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=True)
    body_markdown = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="templates")

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id"))
    recipient_list_id = Column(UUID(as_uuid=True), ForeignKey("recipient_lists.id"))
    provider_config_id = Column(UUID(as_uuid=True), ForeignKey("provider_configs.id"))
    status = Column(Enum(CampaignStatus), default=CampaignStatus.draft)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    delay_min_seconds = Column(Integer, default=0)
    delay_max_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="campaigns")
    template = relationship("Template")
    recipient_list = relationship("RecipientList")
    provider_config = relationship("ProviderConfig")

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"))
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"))
    rendered_subject = Column(Text, nullable=True)
    status = Column(Enum(EmailLogStatus), default=EmailLogStatus.pending)
    provider_message_id = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime(timezone=True), nullable=True)

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("recipients.id"), nullable=True)
    file_path = Column(String, nullable=False)
    is_personalized = Column(Boolean, default=False)

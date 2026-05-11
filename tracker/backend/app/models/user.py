from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from ..core.database import Base


class UserRole(str, enum.Enum):
    super_user = "super"
    manager = "manager"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_id = Column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.user)
    is_active = Column(Boolean, default=True)
    device_label = Column(String(255), nullable=True)  # e.g. "John's Dell XPS"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="users")
    location_events = relationship("LocationEvent", back_populates="user", cascade="all, delete-orphan")

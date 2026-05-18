# tracker/backend/app/models/geofence.py
from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from ..core.database import Base


class Geofence(Base):
    __tablename__ = "geofences"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # A fence belongs to either an org OR a specific user — one of these will be null
    org_id       = Column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=True, index=True)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    name         = Column(String(255), nullable=False)
    # points stored as [[lat, lon], [lat, lon], ...]
    points       = Column(JSONB, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation")
    user         = relationship("User")

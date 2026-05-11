from sqlalchemy import Column, DateTime, ForeignKey, Float, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import uuid
from ..core.database import Base


class LocationEvent(Base):
    __tablename__ = "location_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    point = Column(Geometry("POINT", srid=4326), nullable=False)  # PostGIS geography point
    accuracy_metres = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)          # timestamp from device
    received_at = Column(DateTime(timezone=True), server_default=func.now())  # when server got it

    user = relationship("User", back_populates="location_events")

from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional, List
from datetime import datetime
from ..models.user import UserRole


# --- Auth ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


# --- Organisation ---
class OrgCreate(BaseModel):
    name: str
    slug: str


class OrgOut(BaseModel):
    id: UUID4
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- User ---
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.user
    organisation_id: Optional[UUID4] = None
    device_label: Optional[str] = None


class UserOut(BaseModel):
    id: UUID4
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    device_label: Optional[str]
    organisation_id: Optional[UUID4]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Location ---
class LocationIn(BaseModel):
    latitude: float
    longitude: float
    accuracy_metres: Optional[float] = None
    recorded_at: datetime


class LocationOut(BaseModel):
    id: UUID4
    user_id: UUID4
    latitude: float
    longitude: float
    accuracy_metres: Optional[float]
    recorded_at: datetime
    received_at: datetime

    class Config:
        from_attributes = True


class UserWithLatestLocation(BaseModel):
    user: UserOut
    latest: Optional[LocationOut]


class LocationHistoryOut(BaseModel):
    user_id: UUID4
    points: List[LocationOut]

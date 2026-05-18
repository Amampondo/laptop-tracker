# tracker/backend/app/routes/geofences.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID
from ..core.database import get_db
from ..core.auth import require_manager_or_above, require_any_role
from ..models.geofence import Geofence
from ..models.user import User

router = APIRouter(prefix="/geofences", tags=["geofences"])


class GeofenceIn(BaseModel):
    name: str
    points: List[List[float]]   # [[lat, lon], ...]
    org_id:  Optional[UUID] = None
    user_id: Optional[UUID] = None


class GeofenceOut(BaseModel):
    id: UUID
    name: str
    points: List[List[float]]
    org_id:  Optional[UUID]
    user_id: Optional[UUID]

    class Config:
        from_attributes = True


@router.get("/org/{org_id}", response_model=List[GeofenceOut])
def get_org_fences(org_id: str, db: Session = Depends(get_db), current_user=Depends(require_any_role)):
    return db.query(Geofence).filter(Geofence.org_id == org_id).all()


@router.get("/user/{user_id}", response_model=List[GeofenceOut])
def get_user_fences(user_id: str, db: Session = Depends(get_db), current_user=Depends(require_any_role)):
    return db.query(Geofence).filter(Geofence.user_id == user_id).all()


@router.post("/", response_model=GeofenceOut)
def create_fence(body: GeofenceIn, db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)):
    if not body.org_id and not body.user_id:
        raise HTTPException(status_code=400, detail="Provide either org_id or user_id")
    fence = Geofence(name=body.name, points=body.points, org_id=body.org_id, user_id=body.user_id)
    db.add(fence)
    db.commit()
    db.refresh(fence)
    return fence


@router.delete("/{fence_id}", status_code=200)
def delete_fence(fence_id: str, db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)):
    fence = db.query(Geofence).filter(Geofence.id == fence_id).first()
    if not fence:
        raise HTTPException(status_code=404, detail="Fence not found")
    db.delete(fence)
    db.commit()
    return {"deleted": True}

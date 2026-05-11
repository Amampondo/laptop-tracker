from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.auth import require_super, require_manager_or_above
from ..models.organisation import Organisation
from ..models.user import User
from ..schemas import OrgCreate, OrgOut, UserOut

router = APIRouter(prefix="/organisations", tags=["organisations"])


@router.get("/", response_model=List[OrgOut])
def list_organisations(db: Session = Depends(get_db), _=Depends(require_super)):
    return db.query(Organisation).filter(Organisation.is_active == True).all()


@router.post("/", response_model=OrgOut)
def create_organisation(body: OrgCreate, db: Session = Depends(get_db), _=Depends(require_super)):
    if db.query(Organisation).filter(Organisation.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug already taken")
    org = Organisation(name=body.name, slug=body.slug)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("/{org_id}", response_model=OrgOut)
def get_organisation(org_id: str, db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    # Managers can only see their own org
    if current_user.role == "manager" and str(current_user.organisation_id) != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return org


@router.get("/{org_id}/users", response_model=List[UserOut])
def list_org_users(org_id: str, db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)):
    if current_user.role == "manager" and str(current_user.organisation_id) != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(User).filter(User.organisation_id == org_id, User.is_active == True).all()

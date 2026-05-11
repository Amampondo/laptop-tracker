from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.auth import require_super, require_manager_or_above, require_any_role, get_current_user
from ..models.user import User
from ..schemas import UserCreate, UserOut
from ..core.auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserOut)
def register_user(body: UserCreate, db: Session = Depends(get_db), current_user=Depends(require_manager_or_above)):
    # Managers can only register users into their own org
    if current_user.role == "manager":
        if str(body.organisation_id) != str(current_user.organisation_id):
            raise HTTPException(status_code=403, detail="Cannot register users into another organisation")
        if body.role != "user":
            raise HTTPException(status_code=403, detail="Managers can only create user-role accounts")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        organisation_id=body.organisation_id,
        device_label=body.device_label,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), current_user=Depends(require_any_role)):
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Users can only see themselves
    if current_user.role == "user" and str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    # Managers can only see their org
    if current_user.role == "manager" and str(user.organisation_id) != str(current_user.organisation_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return user

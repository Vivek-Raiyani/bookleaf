"""
Authentication routes: login, register (admin only), profile.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter()


@router.post("/login", response_model=schemas.Token, summary="Login and get JWT token")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with email and password. Returns a JWT access token.
    
    Use the token as `Authorization: Bearer <token>` on all protected endpoints.
    """
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not auth_utils.verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = auth_utils.create_access_token({"sub": user.id, "role": user.role.value})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name,
    }


@router.get("/me", response_model=schemas.UserOut, summary="Get current user profile")
def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    """Returns the currently authenticated user's profile."""
    return current_user


@router.post(
    "/register/admin",
    response_model=schemas.UserOut,
    summary="Create an admin account (admin only)",
)
def create_admin(
    request: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_admin),
):
    """Create a new admin user. Requires admin privileges."""
    if db.query(models.User).filter(models.User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        id=str(uuid.uuid4()),
        email=request.email,
        hashed_password=auth_utils.hash_password(request.password),
        name=request.name,
        role=models.UserRole.admin,
        phone=request.phone,
        city=request.city,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

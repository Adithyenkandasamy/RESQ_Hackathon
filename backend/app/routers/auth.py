"""Authentication endpoints for user login and identity retrieval."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db_session
from app.models.ambulance import Ambulance
from app.models.enums import AmbulanceStatus, UserRole
from app.models.user import User
from app.schemas.auth import (
    AmbulanceCrewRegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register-crew",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new ambulance crew member and vehicle",
)
async def register_ambulance_crew(
    payload: AmbulanceCrewRegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    """Register an ambulance crew member and attach to their ambulance unit."""
    normalized_email = payload.email.lower()
    stmt = select(User).where(User.email == normalized_email)
    res = await session.execute(stmt)
    if res.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    clean_ident = payload.ambulance_identifier.strip().upper()
    amb_stmt = select(Ambulance).where(Ambulance.registration_identifier == clean_ident)
    amb_res = await session.execute(amb_stmt)
    ambulance = amb_res.scalar_one_or_none()

    if ambulance is None:
        ambulance = Ambulance(
            registration_identifier=clean_ident,
            contact_number=payload.contact_number,
            operational_status=AmbulanceStatus.AVAILABLE,
        )
        session.add(ambulance)
        await session.flush()

    new_user = User(
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=UserRole.AMBULANCE_CREW,
        ambulance_id=ambulance.id,
        is_active=True,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    logger.info("New ambulance crew registered: %s (unit=%s)", new_user.email, clean_ident)
    return UserResponse.model_validate(new_user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue access token",
)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Authenticate with email and password to receive a JWT access token."""
    stmt = select(User).where(User.email == payload.email.lower())
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    # Constant-time comparison simulation / safe error message
    if user is None or not verify_password(payload.password, user.password_hash):
        logger.warning("Failed login attempt for email: %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        logger.warning("Login rejected for inactive user: %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token_claims = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
    }
    access_token = create_access_token(token_claims)

    logger.info("User logged in successfully: %s (role=%s)", user.id, user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve the profile of the currently authenticated user.

    Never returns password hashes or access tokens.
    """
    return UserResponse.model_validate(current_user)


"""Authentication endpoints for user login and identity retrieval."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.security import create_access_token, verify_password
from app.database import get_db_session
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


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

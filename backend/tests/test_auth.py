"""Automated tests for authentication, JWT lifecycle, and user profile."""

from __future__ import annotations

from datetime import timedelta

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User


class TestSecurityUtilities:
    """Test Argon2 password hashing and verification."""

    def test_password_hashing_and_verification(self) -> None:
        raw_pass = "MySecretPassw0rd!"
        hashed = hash_password(raw_pass)

        assert hashed != raw_pass
        assert hashed.startswith("$argon2")
        assert verify_password(raw_pass, hashed) is True
        assert verify_password("WrongPassword!", hashed) is False

    def test_verify_password_with_malformed_hash(self) -> None:
        assert verify_password("Password", "not-a-valid-hash") is False


class TestAuthEndpoints:
    """Test login and /me endpoints."""

    async def test_login_success(self, client: httpx.AsyncClient, admin_user: User) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@ercs.org", "password": "AdminSecurePassword1!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_login_invalid_password(
        self, client: httpx.AsyncClient, admin_user: User
    ) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@ercs.org", "password": "IncorrectPassword"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "Invalid email or password" in data["error"]["message"]

    async def test_login_nonexistent_user(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@ercs.org", "password": "AnyPassword123!"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"

    async def test_login_disabled_user_rejected(
        self, client: httpx.AsyncClient, db_session: AsyncSession
    ) -> None:
        disabled_user = User(
            email="disabled@ercs.org",
            password_hash=hash_password("ValidPassword1!"),
            role=UserRole.HOSPITAL_STAFF,
            is_active=False,
        )
        db_session.add(disabled_user)
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "disabled@ercs.org", "password": "ValidPassword1!"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "inactive or disabled" in data["error"]["message"]

    async def test_current_user_me_success(
        self, client: httpx.AsyncClient, admin_user: User, admin_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/auth/me", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@ercs.org"
        assert data["role"] == "ADMIN"
        assert data["is_active"] is True
        # Verify no sensitive fields returned
        assert "password" not in data
        assert "password_hash" not in data
        assert "access_token" not in data

    async def test_current_user_me_unauthenticated(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"

    async def test_current_user_me_expired_token(
        self, client: httpx.AsyncClient, admin_user: User
    ) -> None:
        expired_token = create_access_token(
            {"sub": str(admin_user.id), "email": admin_user.email, "role": admin_user.role.value},
            expires_delta=timedelta(seconds=-10),  # expired
        )
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "expired" in data["error"]["message"].lower()

    async def test_current_user_me_invalid_token(self, client: httpx.AsyncClient) -> None:
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer this-is-not-a-valid-jwt"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"

"""Pytest configuration and shared test fixtures for ERCS Phase 2.

All tests run completely isolated from any external databases using
in-memory SQLite with async sessions. The production Aiven database
is NEVER contacted during automated tests.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.database import Base, get_db_session
from app.main import create_app
from app.models.ambulance import Ambulance
from app.models.enums import AmbulanceStatus, UserRole
from app.models.hospital import Hospital
from app.models.user import User


@pytest.fixture(autouse=True)
def settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set isolated environment variables for tests."""
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-that-is-at-least-32-chars-long")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")


@pytest.fixture
async def test_engine() -> AsyncIterator[Any]:
    """Provide a thread-safe in-memory SQLite engine with tables initialized."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine: Any) -> AsyncIterator[AsyncSession]:
    """Provide an isolated database session bound to the test engine."""
    session_factory = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest.fixture
def app(test_engine: Any) -> FastAPI:
    """Create a FastAPI application with database session dependency overridden."""
    application = create_app()

    session_factory = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
    )

    async def override_get_db_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    application.dependency_overrides[get_db_session] = override_get_db_session
    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """Async test client connected to the FastAPI test application."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ── Health check mocks from Phase 1 ─────────────────────────────


@pytest.fixture
def mock_db_check_ok() -> Any:
    """Patch database.check_connection to return True."""
    with patch("app.routers.health.database.check_connection", new_callable=AsyncMock) as m:
        m.return_value = True
        yield m


@pytest.fixture
def mock_db_check_fail() -> Any:
    """Patch database.check_connection to return False."""
    with patch("app.routers.health.database.check_connection", new_callable=AsyncMock) as m:
        m.return_value = False
        yield m


# ── Seed data fixtures ──────────────────────────────────────────


@pytest.fixture
async def sample_hospital(db_session: AsyncSession) -> Hospital:
    """Create a sample hospital."""
    hospital = Hospital(
        name="Metro General Hospital",
        registration_identifier="HOSP-METRO-001",
        address="100 Healthcare Way, Metro City",
        latitude=37.7749,
        longitude=-122.4194,
        contact_number="+1-555-0100",
        capabilities=["ICU", "TRAUMA_LEVEL_1", "CARDIAC_CARE"],
        reported_availability={"icu_beds": 4, "er_beds": 12, "accepting_patients": True},
    )
    db_session.add(hospital)
    await db_session.commit()
    await db_session.refresh(hospital)
    return hospital


@pytest.fixture
async def other_hospital(db_session: AsyncSession) -> Hospital:
    """Create another hospital for cross-hospital testing."""
    hospital = Hospital(
        name="St. Jude Medical Center",
        registration_identifier="HOSP-SJ-002",
        address="200 Saint Jude Ave, Southside",
        latitude=37.7850,
        longitude=-122.4050,
        contact_number="+1-555-0200",
        capabilities=["PEDIATRIC", "BURN_UNIT"],
        reported_availability={"icu_beds": 1, "accepting_patients": True},
    )
    db_session.add(hospital)
    await db_session.commit()
    await db_session.refresh(hospital)
    return hospital


@pytest.fixture
async def sample_ambulance(db_session: AsyncSession) -> Ambulance:
    """Create a sample ambulance."""
    ambulance = Ambulance(
        registration_identifier="AMB-UNIT-101",
        contact_number="+1-555-0301",
        operational_status=AmbulanceStatus.AVAILABLE,
    )
    db_session.add(ambulance)
    await db_session.commit()
    await db_session.refresh(ambulance)
    return ambulance


@pytest.fixture
async def other_ambulance(db_session: AsyncSession) -> Ambulance:
    """Create a second ambulance for cross-crew testing."""
    ambulance = Ambulance(
        registration_identifier="AMB-UNIT-102",
        contact_number="+1-555-0302",
        operational_status=AmbulanceStatus.AVAILABLE,
    )
    db_session.add(ambulance)
    await db_session.commit()
    await db_session.refresh(ambulance)
    return ambulance


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an administrator user."""
    user = User(
        email="admin@ercs.org",
        password_hash=hash_password("AdminSecurePassword1!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    """Authorization headers for admin user."""
    token = create_access_token(
        {
            "sub": str(admin_user.id),
            "email": admin_user.email,
            "role": admin_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def hospital_staff_user(db_session: AsyncSession, sample_hospital: Hospital) -> User:
    """Create a hospital staff user assigned to sample_hospital."""
    user = User(
        email="staff.metro@ercs.org",
        password_hash=hash_password("StaffSecurePassword1!"),
        role=UserRole.HOSPITAL_STAFF,
        is_active=True,
        hospital_id=sample_hospital.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def hospital_headers(hospital_staff_user: User) -> dict[str, str]:
    """Authorization headers for sample hospital staff user."""
    token = create_access_token(
        {
            "sub": str(hospital_staff_user.id),
            "email": hospital_staff_user.email,
            "role": hospital_staff_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def other_hospital_staff_user(db_session: AsyncSession, other_hospital: Hospital) -> User:
    """Create a hospital staff user assigned to other_hospital."""
    user = User(
        email="staff.stjude@ercs.org",
        password_hash=hash_password("OtherStaffPass1!"),
        role=UserRole.HOSPITAL_STAFF,
        is_active=True,
        hospital_id=other_hospital.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def other_hospital_headers(other_hospital_staff_user: User) -> dict[str, str]:
    """Authorization headers for second hospital staff user."""
    token = create_access_token(
        {
            "sub": str(other_hospital_staff_user.id),
            "email": other_hospital_staff_user.email,
            "role": other_hospital_staff_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def ambulance_crew_user(db_session: AsyncSession, sample_ambulance: Ambulance) -> User:
    """Create an ambulance crew user assigned to sample_ambulance."""
    user = User(
        email="crew101@ercs.org",
        password_hash=hash_password("CrewSecurePassword1!"),
        role=UserRole.AMBULANCE_CREW,
        is_active=True,
        ambulance_id=sample_ambulance.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def ambulance_headers(ambulance_crew_user: User) -> dict[str, str]:
    """Authorization headers for ambulance crew user."""
    token = create_access_token(
        {
            "sub": str(ambulance_crew_user.id),
            "email": ambulance_crew_user.email,
            "role": ambulance_crew_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def other_ambulance_crew_user(db_session: AsyncSession, other_ambulance: Ambulance) -> User:
    """Create a second ambulance crew user assigned to other_ambulance."""
    user = User(
        email="crew102@ercs.org",
        password_hash=hash_password("CrewOtherPass1!"),
        role=UserRole.AMBULANCE_CREW,
        is_active=True,
        ambulance_id=other_ambulance.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def other_ambulance_headers(other_ambulance_crew_user: User) -> dict[str, str]:
    """Authorization headers for second ambulance crew user."""
    token = create_access_token(
        {
            "sub": str(other_ambulance_crew_user.id),
            "email": other_ambulance_crew_user.email,
            "role": other_ambulance_crew_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}

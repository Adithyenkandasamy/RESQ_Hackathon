"""CLI utility to safely create or reset the initial administrator account.

Usage:
    uv run python scripts/create_admin.py --email admin@ercs.local
    # Password will be prompted securely via masked input
    # Or non-interactively:
    uv run python scripts/create_admin.py --email admin@ercs.local --password "StrongAdminPass123!"
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.config import get_settings
from app.core.security import hash_password
from app.database import close_engine, get_db_session, init_engine
from app.models.enums import UserRole
from app.models.user import User


async def create_or_update_admin(email: str, password: str) -> None:
    settings = get_settings()
    if not settings.database_is_configured:
        print("ERROR: DATABASE_URL is not configured in settings or environment.", file=sys.stderr)
        sys.exit(1)

    init_engine(settings.DATABASE_URL)

    normalized_email = email.strip().lower()
    hashed = hash_password(password)

    async for session in get_db_session():
        stmt = select(User).where(User.email == normalized_email)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            admin_user = User(
                email=normalized_email,
                password_hash=hashed,
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin_user)
            await session.commit()
            print(f"Administrator account successfully created: {normalized_email}")
        else:
            user.password_hash = hashed
            user.role = UserRole.ADMIN
            user.is_active = True
            await session.commit()
            print(f"Existing account updated to active administrator: {normalized_email}")
        break

    await close_engine()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Safely create or reset an ERCS administrator account"
    )
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument(
        "--password",
        default=None,
        help="Password (optional; if omitted, you will be prompted securely)",
    )
    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("Enter administrator password: ")
        confirm = getpass.getpass("Confirm administrator password: ")
        if password != confirm:
            print("ERROR: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters long.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(create_or_update_admin(args.email, password))


if __name__ == "__main__":
    main()

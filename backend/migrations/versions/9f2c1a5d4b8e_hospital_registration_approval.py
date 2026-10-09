"""hospital_registration_approval

Add hospital registration lifecycle columns so self-registered hospitals can
be approved or rejected by an administrator before their staff can sign in.

Revision ID: 9f2c1a5d4b8e
Revises: 4d621ebca70a
Create Date: 2026-10-10 00:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f2c1a5d4b8e"
down_revision: str | Sequence[str] | None = "4d621ebca70a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add hospital approval lifecycle fields."""
    op.add_column(
        "hospitals",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="APPROVED",
        ),
    )
    op.add_column(
        "hospitals",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Drop hospital approval lifecycle fields."""
    op.drop_column("hospitals", "rejection_reason")
    op.drop_column("hospitals", "status")
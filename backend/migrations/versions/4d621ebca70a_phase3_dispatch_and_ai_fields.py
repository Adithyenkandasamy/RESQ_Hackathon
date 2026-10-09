"""phase3_dispatch_and_ai_fields

Revision ID: 4d621ebca70a
Revises: adbc4e6f26e3
Create Date: 2026-10-09 23:32:24.416712

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4d621ebca70a"
down_revision: str | Sequence[str] | None = "adbc4e6f26e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add Phase 3 response deadline to hospital requests and AI artifact columns to emergencies."""
    # ── 1. Hospital Requests: response_deadline ──────────────────
    op.add_column(
        "hospital_requests",
        sa.Column(
            "response_deadline",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_hospital_requests_response_deadline",
        "hospital_requests",
        ["response_deadline"],
        unique=False,
    )

    # ── 2. Emergencies: AI artifacts ─────────────────────────────
    op.add_column("emergencies", sa.Column("transcription", sa.JSON(), nullable=True))
    op.add_column("emergencies", sa.Column("ai_extractions", sa.JSON(), nullable=True))
    op.add_column("emergencies", sa.Column("handover_summary", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Drop Phase 3 columns."""
    op.drop_column("emergencies", "handover_summary")
    op.drop_column("emergencies", "ai_extractions")
    op.drop_column("emergencies", "transcription")

    op.drop_index("ix_hospital_requests_response_deadline", table_name="hospital_requests")
    op.drop_column("hospital_requests", "response_deadline")

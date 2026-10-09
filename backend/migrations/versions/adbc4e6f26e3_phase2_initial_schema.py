"""phase2_initial_schema

Revision ID: adbc4e6f26e3
Revises: None
Create Date: 2026-10-09 23:16:50.985942

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "adbc4e6f26e3"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create initial Phase 2 schema: hospitals, ambulances, users, emergencies, requests, and history."""
    # ── 1. Hospitals ──────────────────────────────────────────────
    op.create_table(
        "hospitals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("registration_identifier", sa.String(length=100), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("contact_number", sa.String(length=50), nullable=False),
        sa.Column("capabilities", sa.JSON(), nullable=False),
        sa.Column("reported_availability", sa.JSON(), nullable=False),
        sa.Column("availability_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "registration_identifier", name="uq_hospitals_registration_identifier"
        ),
    )
    op.create_index("ix_hospitals_name", "hospitals", ["name"], unique=False)
    op.create_index(
        "ix_hospitals_registration_identifier",
        "hospitals",
        ["registration_identifier"],
        unique=True,
    )
    op.create_index("ix_hospitals_coords", "hospitals", ["latitude", "longitude"], unique=False)

    # ── 2. Ambulances ────────────────────────────────────────────
    op.create_table(
        "ambulances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("registration_identifier", sa.String(length=100), nullable=False),
        sa.Column("contact_number", sa.String(length=50), nullable=True),
        sa.Column("operational_status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "registration_identifier", name="uq_ambulances_registration_identifier"
        ),
    )
    op.create_index(
        "ix_ambulances_registration_identifier",
        "ambulances",
        ["registration_identifier"],
        unique=True,
    )

    # ── 3. Users ─────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("hospital_id", sa.Uuid(), nullable=True),
        sa.Column("ambulance_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ambulance_id"], ["ambulances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_hospital_id", "users", ["hospital_id"], unique=False)
    op.create_index("ix_users_ambulance_id", "users", ["ambulance_id"], unique=False)

    # ── 4. Emergencies ───────────────────────────────────────────
    op.create_table(
        "emergencies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_ambulance_id", sa.Uuid(), nullable=True),
        sa.Column("confirmed_hospital_id", sa.Uuid(), nullable=True),
        sa.Column("incident_type", sa.String(length=100), nullable=False),
        sa.Column("incident_description", sa.Text(), nullable=True),
        sa.Column("patient_info", sa.JSON(), nullable=False),
        sa.Column("incident_latitude", sa.Float(), nullable=False),
        sa.Column("incident_longitude", sa.Float(), nullable=False),
        sa.Column("location_captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "incident_latitude >= -90.0 AND incident_latitude <= 90.0",
            name="chk_emergency_latitude",
        ),
        sa.CheckConstraint(
            "incident_longitude >= -180.0 AND incident_longitude <= 180.0",
            name="chk_emergency_longitude",
        ),
        sa.ForeignKeyConstraint(["assigned_ambulance_id"], ["ambulances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["confirmed_hospital_id"], ["hospitals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_emergencies_created_by_id", "emergencies", ["created_by_id"], unique=False)
    op.create_index(
        "ix_emergencies_assigned_ambulance_id",
        "emergencies",
        ["assigned_ambulance_id"],
        unique=False,
    )
    op.create_index(
        "ix_emergencies_confirmed_hospital_id",
        "emergencies",
        ["confirmed_hospital_id"],
        unique=False,
    )
    op.create_index("ix_emergencies_status", "emergencies", ["status"], unique=False)
    op.create_index("ix_emergencies_created_at", "emergencies", ["created_at"], unique=False)
    op.create_index(
        "ix_emergencies_status_created_at", "emergencies", ["status", "created_at"], unique=False
    )

    # ── 5. Hospital Requests ─────────────────────────────────────
    op.create_table(
        "hospital_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("emergency_id", sa.Uuid(), nullable=False),
        sa.Column("hospital_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("response_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["emergency_id"], ["emergencies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_hospital_requests_emergency_id", "hospital_requests", ["emergency_id"], unique=False
    )
    op.create_index(
        "ix_hospital_requests_hospital_id", "hospital_requests", ["hospital_id"], unique=False
    )
    op.create_index(
        "ix_hospital_requests_emergency_hospital",
        "hospital_requests",
        ["emergency_id", "hospital_id"],
        unique=False,
    )

    # ── 6. Emergency History ─────────────────────────────────────
    op.create_table(
        "emergency_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("emergency_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("previous_status", sa.String(length=50), nullable=True),
        sa.Column("new_status", sa.String(length=50), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["emergency_id"], ["emergencies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_emergency_history_emergency_id", "emergency_history", ["emergency_id"], unique=False
    )
    op.create_index(
        "ix_emergency_history_emergency_created",
        "emergency_history",
        ["emergency_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop all Phase 2 tables in reverse dependency order."""
    op.drop_table("emergency_history")
    op.drop_table("hospital_requests")
    op.drop_table("emergencies")
    op.drop_table("users")
    op.drop_table("ambulances")
    op.drop_table("hospitals")

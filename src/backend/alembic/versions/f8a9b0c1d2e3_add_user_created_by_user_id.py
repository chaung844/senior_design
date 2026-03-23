"""add user created_by_user_id

Revision ID: f8a9b0c1d2e3
Revises: a1b2c3d4e5f7
Create Date: 2026-03-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_users_created_by_user_id"),
        "users",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_users_created_by_user_id_users"),
        "users",
        "users",
        ["created_by_user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_users_created_by_user_id_users"), "users", type_="foreignkey"
    )
    op.drop_index(op.f("ix_users_created_by_user_id"), table_name="users")
    op.drop_column("users", "created_by_user_id")

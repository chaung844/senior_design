"""drop account_book_members.role (membership is binary; write RBAC is UserRole)

Revision ID: a1b2c3d4e5f7
Revises: 71efc23a8ef1
Create Date: 2026-03-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "71efc23a8ef1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("account_book_members", "role")


def downgrade() -> None:
    op.add_column(
        "account_book_members",
        sa.Column(
            "role",
            sa.Enum("owner", "viewer", name="account_book_role_enum", native_enum=False),
            nullable=False,
            server_default="viewer",
        ),
    )
    op.alter_column(
        "account_book_members",
        "role",
        server_default=None,
    )

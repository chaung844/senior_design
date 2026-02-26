"""add account_id to documents

Revision ID: b3a1c4d5e6f7
Revises: f5e2e37ee399
Create Date: 2026-02-25 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3a1c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f5e2e37ee399"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("account_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_documents_account_id",
        "documents",
        "account_books",
        ["account_id"],
        ["account_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_documents_account_id", "documents", type_="foreignkey")
    op.drop_column("documents", "account_id")

"""add sprint updated_at

Revision ID: 9f1c3d8e2a44
Revises: 7a58a3f91021
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9f1c3d8e2a44'
down_revision: Union[str, Sequence[str], None] = '7a58a3f91021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sprints', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE sprints SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL")


def downgrade() -> None:
    op.drop_column('sprints', 'updated_at')

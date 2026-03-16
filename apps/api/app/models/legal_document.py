from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class LegalDocument(Base):
    """
    Versioned legal document content (terms, privacy, disclaimer, etc.).
    Allows updating legal docs and tracking versions.
    """

    __tablename__ = "legal_documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # terms | privacy | disclaimer | community_guidelines | api_terms | affiliate_disclosure | cookie_policy | rewards_terms
    document_type: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(32), index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

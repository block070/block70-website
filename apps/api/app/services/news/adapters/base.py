from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.news.types import SourceFetchResult


class NewsSourceAdapter(ABC):
    source: str
    adapter_name: str

    @abstractmethod
    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        raise NotImplementedError

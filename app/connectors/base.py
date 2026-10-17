"""Base Search Interfaces and Data Classes."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class RawSearchResult:
    """Standardized search engine result."""

    url: str
    title: str
    snippet: str
    platform: str
    engine: str = "searxng"
    score: float = 0.0


class SearchProvider(ABC):
    """Abstract interface for pluggable search backends."""

    @abstractmethod
    def search(self, query: str, limit: int = 20) -> List[RawSearchResult]:
        """Execute a search query and return standardized results."""
        pass

from abc import ABC, abstractmethod

from linkedln_scrapper.domain.models import RawJob


class BaseJobScraper(ABC):
    @abstractmethod
    async def scrape_search(self, search_url: str) -> list[str]:
        """Return discovered job detail URLs."""

    @abstractmethod
    async def scrape_job_detail(self, job_url: str) -> RawJob | None:
        """Return raw job data from a rendered detail page."""

    @abstractmethod
    async def scrape_many_details(self, job_urls: list[str]) -> list[RawJob | None]:
        """Return raw jobs for many detail URLs with implementation-specific concurrency."""

    @abstractmethod
    async def close(self) -> None:
        """Close browser resources."""

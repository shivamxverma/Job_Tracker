import asyncio
import logging
from pathlib import Path

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from linkedln_scrapper.config.settings import ScrapingSettings, SecretSettings
from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.scraping.base import BaseJobScraper
from linkedln_scrapper.scraping.linkedin.browser import BrowserManager
from linkedln_scrapper.scraping.linkedin.detail_page import (
    AntiBotDetectedError,
    LinkedInDetailPageScraper,
)
from linkedln_scrapper.scraping.linkedin.parser import LinkedInParser
from linkedln_scrapper.scraping.linkedin.rate_limit import RateLimiter
from linkedln_scrapper.scraping.linkedin.search_page import LinkedInSearchPageScraper
from linkedln_scrapper.scraping.linkedin.selectors import SelectorRegistry
from linkedln_scrapper.scraping.linkedin.snapshots import SnapshotStore

LOGGER = logging.getLogger(__name__)


class LinkedInScraper(BaseJobScraper):
    def __init__(
        self,
        settings: ScrapingSettings,
        secrets: SecretSettings,
        project_root: Path,
        run_id: str,
        headless: bool = False,
    ):
        selectors_path = project_root / settings.selectors_path
        self.selectors = SelectorRegistry.from_yaml(selectors_path)
        self.rate_limiter = RateLimiter(settings.min_delay_seconds, settings.max_delay_seconds)
        self.browser = BrowserManager(
            user_data_dir=secrets.linkedin_user_data_dir,
            storage_state=secrets.linkedin_storage_state,
            headless=headless,
            timeout_ms=settings.page_timeout_ms,
        )
        self.snapshot_store = SnapshotStore(project_root / "data" / "snapshots")
        self.parser = LinkedInParser(self.selectors)
        self.search_page = LinkedInSearchPageScraper(
            selectors=self.selectors,
            rate_limiter=self.rate_limiter,
            max_scroll_attempts=settings.max_scroll_attempts,
            max_jobs_per_search=settings.max_jobs_per_search,
        )
        self.detail_page = LinkedInDetailPageScraper(
            selectors=self.selectors,
            parser=self.parser,
            rate_limiter=self.rate_limiter,
            snapshot_store=self.snapshot_store,
            run_id=run_id,
            snapshot_on_error=settings.snapshot_on_error,
            snapshot_sample_rate=settings.snapshot_sample_rate,
        )
        self.semaphore = asyncio.Semaphore(settings.max_detail_concurrency)

    @retry(
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        wait=wait_exponential_jitter(initial=2, max=30),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def scrape_search(self, search_url: str) -> list[str]:
        page = await self.browser.new_page()
        try:
            return await self.search_page.scrape(page, search_url)
        finally:
            await page.close()

    async def scrape_job_detail(self, job_url: str) -> RawJob | None:
        async with self.semaphore:
            page = await self.browser.new_page()
            try:
                return await self.detail_page.scrape(page, job_url)
            except AntiBotDetectedError:
                raise
            except Exception as exc:
                LOGGER.warning("failed to scrape job detail url=%s error=%s", job_url, exc)
                return None
            finally:
                await page.close()

    async def scrape_many_details(self, job_urls: list[str]) -> list[RawJob | None]:
        return await asyncio.gather(*(self.scrape_job_detail(url) for url in job_urls))

    async def close(self) -> None:
        await self.browser.close()

import random

from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.scraping.linkedin.parser import LinkedInParser
from linkedln_scrapper.scraping.linkedin.rate_limit import RateLimiter
from linkedln_scrapper.scraping.linkedin.selectors import SelectorRegistry
from linkedln_scrapper.scraping.linkedin.snapshots import SnapshotStore


class AntiBotDetectedError(RuntimeError):
    pass


class LinkedInDetailPageScraper:
    def __init__(
        self,
        selectors: SelectorRegistry,
        parser: LinkedInParser,
        rate_limiter: RateLimiter,
        snapshot_store: SnapshotStore,
        run_id: str,
        snapshot_on_error: bool,
        snapshot_sample_rate: float,
    ):
        self.selectors = selectors
        self.parser = parser
        self.rate_limiter = rate_limiter
        self.snapshot_store = snapshot_store
        self.run_id = run_id
        self.snapshot_on_error = snapshot_on_error
        self.snapshot_sample_rate = snapshot_sample_rate

    async def scrape(self, page, job_url: str) -> RawJob:
        try:
            await page.goto(job_url, wait_until="domcontentloaded")
            await self.rate_limiter.wait()
            await self._raise_if_checkpoint(page)

            description_selectors = self.selectors.all("job_detail", "description")
            if description_selectors:
                await page.wait_for_selector(", ".join(description_selectors))

            html = await page.content()
            snapshot_path = None
            if self.snapshot_sample_rate > 0 and random.random() < self.snapshot_sample_rate:
                snapshot_path = await self.snapshot_store.save_page(page, job_url, self.run_id, "sample")
            return self.parser.parse_detail_html(html, job_url, raw_html_path=snapshot_path)
        except Exception:
            if self.snapshot_on_error:
                await self.snapshot_store.save_page(page, job_url, self.run_id, "error")
            raise

    async def _raise_if_checkpoint(self, page) -> None:
        html = (await page.content()).casefold()
        for marker in self.selectors.all("anti_bot", "checkpoint_markers"):
            if marker.casefold() in html:
                raise AntiBotDetectedError(f"LinkedIn checkpoint marker detected: {marker}")

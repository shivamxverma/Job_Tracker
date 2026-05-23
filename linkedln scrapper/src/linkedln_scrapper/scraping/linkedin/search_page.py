from urllib.parse import urljoin

from linkedln_scrapper.scraping.linkedin.rate_limit import RateLimiter
from linkedln_scrapper.scraping.linkedin.selectors import SelectorRegistry


class LinkedInSearchPageScraper:
    def __init__(
        self,
        selectors: SelectorRegistry,
        rate_limiter: RateLimiter,
        max_scroll_attempts: int,
        max_jobs_per_search: int,
    ):
        self.selectors = selectors
        self.rate_limiter = rate_limiter
        self.max_scroll_attempts = max_scroll_attempts
        self.max_jobs_per_search = max_jobs_per_search

    async def scrape(self, page, search_url: str) -> list[str]:
        await page.goto(search_url, wait_until="domcontentloaded")
        await self.rate_limiter.wait()

        container_selector = self.selectors.first("job_card", "container")
        if container_selector:
            await page.wait_for_selector(container_selector)

        urls: list[str] = []
        seen: set[str] = set()

        for _ in range(self.max_scroll_attempts):
            urls.extend(await self._extract_urls(page, seen))
            if len(seen) >= self.max_jobs_per_search:
                break
            await page.mouse.wheel(0, 2200)
            await self.rate_limiter.wait()

        return urls[: self.max_jobs_per_search]

    async def _extract_urls(self, page, seen: set[str]) -> list[str]:
        found: list[str] = []
        for selector in self.selectors.all("job_card", "url"):
            locators = await page.locator(selector).all()
            for locator in locators:
                href = await locator.get_attribute("href")
                if not href:
                    continue
                absolute = urljoin("https://www.linkedin.com", href)
                if "/jobs/view/" not in absolute or absolute in seen:
                    continue
                seen.add(absolute)
                found.append(absolute)
        return found

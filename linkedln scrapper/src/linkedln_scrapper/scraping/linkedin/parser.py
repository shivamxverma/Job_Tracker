from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.normalization.text import clean_text
from linkedln_scrapper.scraping.linkedin.selectors import SelectorRegistry


class LinkedInParser:
    def __init__(self, selectors: SelectorRegistry):
        self.selectors = selectors

    def parse_detail_html(self, html: str, job_url: str, raw_html_path: str | None = None) -> RawJob:
        soup = self._soup(html)
        return RawJob(
            job_url=job_url,
            title=self._first_text(soup, "job_detail", "title"),
            company=self._first_text(soup, "job_detail", "company"),
            location=self._first_text(soup, "job_detail", "location"),
            description=self._first_text(soup, "job_detail", "description"),
            raw_html_path=raw_html_path,
        )

    def _soup(self, html: str):
        try:
            from bs4 import BeautifulSoup
        except ImportError as exc:
            raise RuntimeError("beautifulsoup4 is required for HTML parsing") from exc
        return BeautifulSoup(html, "html.parser")

    def _first_text(self, soup, *selector_path: str) -> str | None:
        for selector in self.selectors.all(*selector_path):
            element = soup.select_one(selector)
            if element:
                text = clean_text(element.get_text(" ", strip=True))
                if text:
                    return text
        return None

import asyncio
from datetime import UTC, datetime

from linkedln_scrapper.application.deduplication_service import DeduplicationService
from linkedln_scrapper.application.notification_service import NotificationService
from linkedln_scrapper.application.ranking_service import RankingService
from linkedln_scrapper.domain.models import IngestionRun, RawJob
from linkedln_scrapper.normalization.normalizer import JobNormalizer
from linkedln_scrapper.storage.base import JobRepository


class JobIngestionService:
    def __init__(
        self,
        scraper,
        normalizer: JobNormalizer,
        deduper: DeduplicationService,
        job_repository: JobRepository,
        ranking_service: RankingService,
        notification_service: NotificationService,
    ):
        self.scraper = scraper
        self.normalizer = normalizer
        self.deduper = deduper
        self.job_repository = job_repository
        self.ranking_service = ranking_service
        self.notification_service = notification_service

    async def run(self, search_urls: list[str], run: IngestionRun) -> IngestionRun:
        run.search_count = len(search_urls)
        try:
            for search_url in search_urls:
                job_urls = await self.scraper.scrape_search(search_url)
                run.jobs_discovered += len(job_urls)
                raw_jobs = await self._scrape_details(job_urls)

                for raw_job in raw_jobs:
                    job = self.normalizer.normalize(raw_job)
                    if self.deduper.is_duplicate(job):
                        run.jobs_duplicate += 1
                        continue

                    self.job_repository.upsert(job)
                    run.jobs_new += 1

                    recommendation = self.ranking_service.rank(job, run_id=run.run_id)
                    run.jobs_ranked += 1

                    if await self.notification_service.maybe_send(job, recommendation):
                        run.notifications_sent += 1
        finally:
            run.finished_at = datetime.now(UTC)
            await self.scraper.close()
        return run

    async def _scrape_details(self, job_urls: list[str]) -> list[RawJob]:
        raw_jobs = await self.scraper.scrape_many_details(job_urls)
        return [job for job in raw_jobs if job is not None]

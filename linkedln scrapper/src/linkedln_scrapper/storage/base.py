from typing import Protocol

from linkedln_scrapper.domain.models import JobPosting, JobRecommendation, NotificationRecord


class JobRepository(Protocol):
    def find_duplicate(self, job: JobPosting) -> JobPosting | None:
        ...

    def upsert(self, job: JobPosting) -> None:
        ...

    def list_recent(self, limit: int = 500) -> list[JobPosting]:
        ...


class RecommendationRepository(Protocol):
    def save(self, recommendation: JobRecommendation) -> None:
        ...


class NotificationRepository(Protocol):
    def was_notified(self, job_id: str, channel: str) -> bool:
        ...

    def save(self, notification: NotificationRecord) -> None:
        ...

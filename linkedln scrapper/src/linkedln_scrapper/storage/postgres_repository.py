"""
Future PostgreSQL storage adapter.

The application layer already depends on repository protocols from storage.base.
When CSV becomes limiting, implement those protocols here with SQLAlchemy and keep the
ingestion/ranking/notification services unchanged.
"""

from linkedln_scrapper.domain.models import JobPosting, JobRecommendation, NotificationRecord


class PostgresJobRepository:
    def find_duplicate(self, job: JobPosting) -> JobPosting | None:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")

    def upsert(self, job: JobPosting) -> None:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")

    def list_recent(self, limit: int = 500) -> list[JobPosting]:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")


class PostgresRecommendationRepository:
    def save(self, recommendation: JobRecommendation) -> None:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")


class PostgresNotificationRepository:
    def was_notified(self, job_id: str, channel: str) -> bool:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")

    def save(self, notification: NotificationRecord) -> None:
        raise NotImplementedError("PostgreSQL storage is planned for V2.")

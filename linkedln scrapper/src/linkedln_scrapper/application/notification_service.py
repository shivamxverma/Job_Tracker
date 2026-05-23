import hashlib
from datetime import UTC, datetime

from linkedln_scrapper.domain.enums import NotificationStatus, RecommendationDecision
from linkedln_scrapper.domain.models import JobPosting, JobRecommendation, NotificationRecord
from linkedln_scrapper.notifications.base import Notifier
from linkedln_scrapper.notifications.formatting import format_telegram_message
from linkedln_scrapper.storage.base import NotificationRepository


class NotificationService:
    def __init__(
        self,
        notifier: Notifier,
        notification_repository: NotificationRepository,
        max_per_run: int,
        channel: str = "telegram",
    ):
        self.notifier = notifier
        self.notification_repository = notification_repository
        self.max_per_run = max_per_run
        self.channel = channel
        self._sent_this_run = 0

    async def maybe_send(self, job: JobPosting, recommendation: JobRecommendation) -> bool:
        if recommendation.decision != RecommendationDecision.SEND:
            return False
        if self._sent_this_run >= self.max_per_run:
            return False
        if self.notification_repository.was_notified(job.job_id, self.channel):
            return False

        message = format_telegram_message(job, recommendation)
        message_hash = hashlib.sha256(message.encode("utf-8")).hexdigest()[:24]
        notification_id = hashlib.sha256(
            f"{job.job_id}:{self.channel}:{message_hash}".encode("utf-8")
        ).hexdigest()[:24]

        try:
            await self.notifier.send_message(message)
            record = NotificationRecord(
                notification_id=notification_id,
                job_id=job.job_id,
                channel=self.channel,
                message_hash=message_hash,
                status=NotificationStatus.SENT,
                sent_at=datetime.now(UTC),
            )
            self._sent_this_run += 1
            self.notification_repository.save(record)
            return True
        except Exception as exc:
            record = NotificationRecord(
                notification_id=notification_id,
                job_id=job.job_id,
                channel=self.channel,
                message_hash=message_hash,
                status=NotificationStatus.FAILED,
                error=str(exc),
            )
            self.notification_repository.save(record)
            raise

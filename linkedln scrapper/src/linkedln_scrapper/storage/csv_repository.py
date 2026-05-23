import csv
import json
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from linkedln_scrapper.domain.enums import NotificationStatus, RecommendationDecision, Seniority, Source
from linkedln_scrapper.domain.models import JobPosting, JobRecommendation, NotificationRecord, ScoreBreakdown


JOB_FIELDS = [
    "job_id",
    "source",
    "source_job_id",
    "canonical_url",
    "title",
    "company",
    "location",
    "workplace_type",
    "seniority",
    "description",
    "skills",
    "employment_type",
    "posted_at",
    "first_seen_at",
    "last_seen_at",
    "scraped_at",
    "content_hash",
    "status",
]

RECOMMENDATION_FIELDS = [
    "recommendation_id",
    "job_id",
    "run_id",
    "score",
    "decision",
    "breakdown",
    "matched_skills",
    "matched_interests",
    "missing_skills",
    "positive_reasons",
    "negative_reasons",
    "created_at",
]

NOTIFICATION_FIELDS = [
    "notification_id",
    "job_id",
    "channel",
    "message_hash",
    "status",
    "sent_at",
    "error",
]


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _write_rows_atomic(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    _ensure_parent(path)
    with NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as temp:
        writer = csv.DictWriter(temp, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        temp_path = Path(temp.name)
    temp_path.replace(path)


def _read_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def _dt_to_str(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _str_to_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


class CSVJobRepository:
    def __init__(self, csv_dir: Path):
        self.path = csv_dir / "jobs.csv"

    def find_duplicate(self, job: JobPosting) -> JobPosting | None:
        for existing in self.list_recent(limit=100_000):
            if job.source_job_id and existing.source_job_id == job.source_job_id:
                return existing
            if existing.canonical_url == job.canonical_url:
                return existing
            if existing.content_hash == job.content_hash:
                return existing
        return None

    def upsert(self, job: JobPosting) -> None:
        rows = _read_rows(self.path)
        row_by_id = {row["job_id"]: row for row in rows}
        existing = row_by_id.get(job.job_id)
        if existing:
            first_seen = existing.get("first_seen_at") or _dt_to_str(job.first_seen_at)
            status = "changed" if existing.get("content_hash") != job.content_hash else "seen"
            row_by_id[job.job_id] = self._to_row(job, first_seen_at=first_seen, status=status)
        else:
            row_by_id[job.job_id] = self._to_row(job, status=job.status)
        _write_rows_atomic(self.path, JOB_FIELDS, list(row_by_id.values()))

    def list_recent(self, limit: int = 500) -> list[JobPosting]:
        rows = _read_rows(self.path)
        jobs = [self._from_row(row) for row in rows]
        jobs.sort(key=lambda job: job.last_seen_at, reverse=True)
        return jobs[:limit]

    def _to_row(
        self,
        job: JobPosting,
        first_seen_at: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "source": job.source.value,
            "source_job_id": job.source_job_id or "",
            "canonical_url": job.canonical_url,
            "title": job.title,
            "company": job.company,
            "location": job.location or "",
            "workplace_type": job.workplace_type.value,
            "seniority": job.seniority.value,
            "description": job.description,
            "skills": json.dumps(job.skills, ensure_ascii=True),
            "employment_type": job.employment_type,
            "posted_at": _dt_to_str(job.posted_at),
            "first_seen_at": first_seen_at or _dt_to_str(job.first_seen_at),
            "last_seen_at": _dt_to_str(job.last_seen_at),
            "scraped_at": _dt_to_str(job.scraped_at),
            "content_hash": job.content_hash,
            "status": status or job.status,
        }

    def _from_row(self, row: dict[str, str]) -> JobPosting:
        return JobPosting(
            job_id=row["job_id"],
            source=Source(row.get("source") or Source.LINKEDIN.value),
            source_job_id=row.get("source_job_id") or None,
            canonical_url=row["canonical_url"],
            title=row["title"],
            company=row["company"],
            location=row.get("location") or None,
            workplace_type=row.get("workplace_type") or "unknown",
            seniority=Seniority(row.get("seniority") or "unknown"),
            description=row.get("description") or "",
            skills=json.loads(row.get("skills") or "[]"),
            employment_type=row.get("employment_type") or "unknown",
            posted_at=_str_to_dt(row.get("posted_at")),
            first_seen_at=_str_to_dt(row.get("first_seen_at")) or _str_to_dt(row.get("scraped_at")),
            last_seen_at=_str_to_dt(row.get("last_seen_at")) or _str_to_dt(row.get("scraped_at")),
            scraped_at=_str_to_dt(row.get("scraped_at")) or _str_to_dt(row.get("last_seen_at")),
            content_hash=row["content_hash"],
            status=row.get("status") or "seen",
        )


class CSVRecommendationRepository:
    def __init__(self, csv_dir: Path):
        self.path = csv_dir / "recommendations.csv"

    def save(self, recommendation: JobRecommendation) -> None:
        rows = _read_rows(self.path)
        row_by_id = {row["recommendation_id"]: row for row in rows}
        row_by_id[recommendation.recommendation_id] = self._to_row(recommendation)
        _write_rows_atomic(self.path, RECOMMENDATION_FIELDS, list(row_by_id.values()))

    def _to_row(self, recommendation: JobRecommendation) -> dict[str, Any]:
        return {
            "recommendation_id": recommendation.recommendation_id,
            "job_id": recommendation.job_id,
            "run_id": recommendation.run_id,
            "score": f"{recommendation.score:.2f}",
            "decision": recommendation.decision.value,
            "breakdown": recommendation.breakdown.model_dump_json(),
            "matched_skills": json.dumps(recommendation.matched_skills, ensure_ascii=True),
            "matched_interests": json.dumps(recommendation.matched_interests, ensure_ascii=True),
            "missing_skills": json.dumps(recommendation.missing_skills, ensure_ascii=True),
            "positive_reasons": json.dumps(recommendation.positive_reasons, ensure_ascii=True),
            "negative_reasons": json.dumps(recommendation.negative_reasons, ensure_ascii=True),
            "created_at": _dt_to_str(recommendation.created_at),
        }

    def from_row(self, row: dict[str, str]) -> JobRecommendation:
        return JobRecommendation(
            recommendation_id=row["recommendation_id"],
            job_id=row["job_id"],
            run_id=row["run_id"],
            score=float(row["score"]),
            decision=RecommendationDecision(row["decision"]),
            breakdown=ScoreBreakdown.model_validate_json(row.get("breakdown") or "{}"),
            matched_skills=json.loads(row.get("matched_skills") or "[]"),
            matched_interests=json.loads(row.get("matched_interests") or "[]"),
            missing_skills=json.loads(row.get("missing_skills") or "[]"),
            positive_reasons=json.loads(row.get("positive_reasons") or "[]"),
            negative_reasons=json.loads(row.get("negative_reasons") or "[]"),
            created_at=_str_to_dt(row.get("created_at")) or datetime.now(),
        )


class CSVNotificationRepository:
    def __init__(self, csv_dir: Path):
        self.path = csv_dir / "notifications.csv"

    def was_notified(self, job_id: str, channel: str) -> bool:
        for row in _read_rows(self.path):
            if row.get("job_id") == job_id and row.get("channel") == channel:
                if row.get("status") == NotificationStatus.SENT.value:
                    return True
        return False

    def save(self, notification: NotificationRecord) -> None:
        rows = _read_rows(self.path)
        row_by_id = {row["notification_id"]: row for row in rows}
        row_by_id[notification.notification_id] = {
            "notification_id": notification.notification_id,
            "job_id": notification.job_id,
            "channel": notification.channel,
            "message_hash": notification.message_hash,
            "status": notification.status.value,
            "sent_at": _dt_to_str(notification.sent_at),
            "error": notification.error or "",
        }
        _write_rows_atomic(self.path, NOTIFICATION_FIELDS, list(row_by_id.values()))

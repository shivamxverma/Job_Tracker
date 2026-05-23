from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from linkedln_scrapper.domain.enums import (
    NotificationStatus,
    RecommendationDecision,
    Seniority,
    Source,
    WorkplaceType,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


class RawJob(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: Source = Source.LINKEDIN
    source_job_id: str | None = None
    job_url: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    description: str | None = None
    skills: list[str] = Field(default_factory=list)
    seniority: str | None = None
    workplace_type: str | None = None
    employment_type: str | None = None
    posted_at_text: str | None = None
    raw_html_path: str | None = None
    scraped_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)


class JobPosting(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str
    source: Source = Source.LINKEDIN
    source_job_id: str | None = None
    canonical_url: str
    title: str
    company: str
    location: str | None = None
    workplace_type: WorkplaceType = WorkplaceType.UNKNOWN
    seniority: Seniority = Seniority.UNKNOWN
    description: str = ""
    skills: list[str] = Field(default_factory=list)
    employment_type: str = "unknown"
    posted_at: datetime | None = None
    first_seen_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now)
    scraped_at: datetime = Field(default_factory=utc_now)
    content_hash: str
    status: str = "new"

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, skills: list[str]) -> list[str]:
        seen: set[str] = set()
        normalized: list[str] = []
        for skill in skills:
            cleaned = " ".join(skill.split()).strip()
            if not cleaned:
                continue
            key = cleaned.casefold()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
        return normalized


class ResumeProfile(BaseModel):
    roles: list[str] = Field(default_factory=list)
    skills: set[str] = Field(default_factory=set)
    technologies: set[str] = Field(default_factory=set)
    projects: list[str] = Field(default_factory=list)


class InterestProfile(BaseModel):
    strong: set[str] = Field(default_factory=set)
    moderate: set[str] = Field(default_factory=set)


class NegativePreferences(BaseModel):
    hard_reject: set[str] = Field(default_factory=set)
    soft_negative: set[str] = Field(default_factory=set)


class UserPreferences(BaseModel):
    seniority: set[Seniority] = Field(default_factory=set)
    workplace: set[WorkplaceType] = Field(default_factory=set)


class UserProfile(BaseModel):
    resume: ResumeProfile = Field(default_factory=ResumeProfile)
    interests: InterestProfile = Field(default_factory=InterestProfile)
    preferred_stack: set[str] = Field(default_factory=set)
    negative_preferences: NegativePreferences = Field(default_factory=NegativePreferences)
    preferences: UserPreferences = Field(default_factory=UserPreferences)

    @property
    def all_positive_terms(self) -> set[str]:
        return (
            set(self.resume.roles)
            | set(self.resume.skills)
            | set(self.resume.technologies)
            | set(self.interests.strong)
            | set(self.interests.moderate)
            | set(self.preferred_stack)
        )


class ScoreBreakdown(BaseModel):
    title: float = 0
    skills: float = 0
    interests: float = 0
    seniority: float = 0
    workplace: float = 0
    recency: float = 0
    description_quality: float = 0
    preferred_stack: float = 0
    penalties: float = 0

    @property
    def total(self) -> float:
        return (
            self.title
            + self.skills
            + self.interests
            + self.seniority
            + self.workplace
            + self.recency
            + self.description_quality
            + self.preferred_stack
            + self.penalties
        )


class JobRecommendation(BaseModel):
    recommendation_id: str
    job_id: str
    run_id: str
    score: float
    decision: RecommendationDecision
    breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    matched_skills: list[str] = Field(default_factory=list)
    matched_interests: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    positive_reasons: list[str] = Field(default_factory=list)
    negative_reasons: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)


class NotificationRecord(BaseModel):
    notification_id: str
    job_id: str
    channel: str
    message_hash: str
    status: NotificationStatus
    sent_at: datetime | None = None
    error: str | None = None


class IngestionRun(BaseModel):
    run_id: str
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: datetime | None = None
    search_count: int = 0
    jobs_discovered: int = 0
    jobs_new: int = 0
    jobs_duplicate: int = 0
    jobs_ranked: int = 0
    notifications_sent: int = 0
    errors: list[str] = Field(default_factory=list)

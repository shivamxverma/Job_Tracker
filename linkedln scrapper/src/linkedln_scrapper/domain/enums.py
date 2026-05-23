from enum import StrEnum


class Source(StrEnum):
    LINKEDIN = "linkedin"


class WorkplaceType(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class Seniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    STAFF = "staff"
    LEAD = "lead"
    MANAGER = "manager"
    UNKNOWN = "unknown"


class RecommendationDecision(StrEnum):
    SEND = "send"
    HOLD = "hold"
    REJECT = "reject"


class NotificationStatus(StrEnum):
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"

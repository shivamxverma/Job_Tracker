from linkedln_scrapper.domain.enums import Seniority, WorkplaceType
from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.normalization.normalizer import JobNormalizer


def test_normalizer_canonicalizes_and_extracts_linkedin_id():
    raw = RawJob(
        job_url="https://www.linkedin.com/jobs/view/12345/?trackingId=abc&currentJobId=12345",
        title=" Senior Backend Engineer ",
        company="Example Co",
        location="Remote - India",
        description="Build Python APIs with FastAPI, PostgreSQL, Kafka, Redis, and AWS.",
    )

    job = JobNormalizer().normalize(raw)

    assert job.source_job_id == "12345"
    assert job.canonical_url == "https://www.linkedin.com/jobs/view/12345?currentJobId=12345"
    assert job.title == "Senior Backend Engineer"
    assert job.workplace_type == WorkplaceType.REMOTE
    assert job.seniority == Seniority.SENIOR
    assert {"Python", "FastAPI", "PostgreSQL", "Kafka", "Redis", "AWS"}.issubset(set(job.skills))

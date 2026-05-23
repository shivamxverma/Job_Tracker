import hashlib
import re
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from linkedln_scrapper.domain.enums import Seniority, Source, WorkplaceType
from linkedln_scrapper.domain.models import JobPosting, RawJob
from linkedln_scrapper.normalization.locations import infer_workplace_type
from linkedln_scrapper.normalization.seniority import infer_seniority
from linkedln_scrapper.normalization.skills import extract_known_skills, merge_skills
from linkedln_scrapper.normalization.text import clean_text


LINKEDIN_JOB_ID_RE = re.compile(r"/jobs/view/(\d+)")


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    kept_query = {
        key: value
        for key, value in query.items()
        if key in {"currentJobId"} and value
    }
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path.rstrip("/"),
            "",
            urlencode(kept_query, doseq=True),
            "",
        )
    )


def extract_linkedin_job_id(url: str) -> str | None:
    match = LINKEDIN_JOB_ID_RE.search(url)
    if match:
        return match.group(1)
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    current_job_id = query.get("currentJobId")
    return current_job_id[0] if current_job_id else None


def hash_content(*parts: str | None) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(clean_text(part).casefold().encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()


class JobNormalizer:
    def normalize(self, raw: RawJob) -> JobPosting:
        canonical_url = canonicalize_url(raw.job_url)
        source_job_id = raw.source_job_id or extract_linkedin_job_id(canonical_url)
        title = clean_text(raw.title) or "Unknown title"
        company = clean_text(raw.company) or "Unknown company"
        location = clean_text(raw.location) or None
        description = clean_text(raw.description)
        inferred_skills = extract_known_skills(f"{title} {description}")
        skills = merge_skills(raw.skills, inferred_skills)

        workplace = self._normalize_workplace(raw.workplace_type, location, description)
        seniority = self._normalize_seniority(raw.seniority, title, description)
        content_hash = hash_content(title, company, location, description)
        job_id = self._job_id(raw.source, source_job_id, canonical_url, title, company)

        now = datetime.now(UTC)
        return JobPosting(
            job_id=job_id,
            source=raw.source,
            source_job_id=source_job_id,
            canonical_url=canonical_url,
            title=title,
            company=company,
            location=location,
            workplace_type=workplace,
            seniority=seniority,
            description=description,
            skills=skills,
            employment_type=clean_text(raw.employment_type) or "unknown",
            posted_at=None,
            first_seen_at=now,
            last_seen_at=now,
            scraped_at=raw.scraped_at,
            content_hash=content_hash,
        )

    def _normalize_workplace(
        self,
        value: str | None,
        location: str | None,
        description: str | None,
    ) -> WorkplaceType:
        cleaned = clean_text(value).casefold()
        for workplace in WorkplaceType:
            if cleaned == workplace.value:
                return workplace
        return infer_workplace_type(location, description)

    def _normalize_seniority(
        self,
        value: str | None,
        title: str | None,
        description: str | None,
    ) -> Seniority:
        cleaned = clean_text(value).casefold()
        for seniority in Seniority:
            if cleaned == seniority.value:
                return seniority
        return infer_seniority(title, description)

    def _job_id(
        self,
        source: Source,
        source_job_id: str | None,
        canonical_url: str,
        title: str,
        company: str,
    ) -> str:
        stable_key = source_job_id or canonical_url or f"{title}:{company}"
        return hash_content(source.value, stable_key)[:24]

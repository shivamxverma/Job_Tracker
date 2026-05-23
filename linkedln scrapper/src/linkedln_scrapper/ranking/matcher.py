from linkedln_scrapper.domain.models import JobPosting
from linkedln_scrapper.normalization.text import clean_text, stable_term_key
from linkedln_scrapper.ranking.profile import NormalizedProfile


def job_text(job: JobPosting) -> str:
    return clean_text(
        " ".join(
            [
                job.title,
                job.company,
                job.location or "",
                job.description,
                " ".join(job.skills),
                job.seniority.value,
                job.workplace_type.value,
            ]
        )
    )


class ProfileMatcher:
    def __init__(self, profile: NormalizedProfile):
        self.profile = profile

    def matched_skills(self, job: JobPosting) -> list[str]:
        job_skill_keys = {stable_term_key(skill) for skill in job.skills}
        matched = [
            original
            for key, original in self.profile.resume_skills.items()
            if key in job_skill_keys or key in job_text(job).casefold()
        ]
        return sorted(set(matched), key=str.casefold)

    def matched_preferred_stack(self, job: JobPosting) -> list[str]:
        text = job_text(job).casefold()
        job_skill_keys = {stable_term_key(skill) for skill in job.skills}
        matched = [
            original
            for key, original in self.profile.preferred_stack.items()
            if key in job_skill_keys or key in text
        ]
        return sorted(set(matched), key=str.casefold)

    def matched_interests(self, job: JobPosting) -> list[str]:
        text = job_text(job).casefold()
        matches: list[str] = []
        for key, original in self.profile.strong_interests.items():
            if key in text:
                matches.append(original)
        for key, original in self.profile.moderate_interests.items():
            if key in text:
                matches.append(original)
        return sorted(set(matches), key=str.casefold)

    def negative_terms(self, job: JobPosting) -> tuple[list[str], list[str]]:
        text = job_text(job).casefold()
        hard = [original for key, original in self.profile.hard_negatives.items() if key in text]
        soft = [original for key, original in self.profile.soft_negatives.items() if key in text]
        return sorted(hard, key=str.casefold), sorted(soft, key=str.casefold)

    def missing_relevant_skills(self, job: JobPosting) -> list[str]:
        known = set(self.profile.resume_skills) | set(self.profile.preferred_stack)
        missing: list[str] = []
        for skill in job.skills:
            key = stable_term_key(skill)
            if key and key not in known:
                missing.append(skill)
        return sorted(set(missing), key=str.casefold)

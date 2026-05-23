from collections import Counter

from linkedln_scrapper.domain.models import JobPosting, UserProfile
from linkedln_scrapper.normalization.text import stable_term_key


class SkillGapAnalyzer:
    def __init__(self, profile: UserProfile):
        self.profile = profile

    def missing_skill_counts(self, jobs: list[JobPosting], min_count: int = 2) -> list[tuple[str, int]]:
        known = {
            stable_term_key(skill)
            for skill in (set(self.profile.resume.skills) | set(self.profile.preferred_stack))
        }
        counter: Counter[str] = Counter()
        original_by_key: dict[str, str] = {}
        for job in jobs:
            for skill in job.skills:
                key = stable_term_key(skill)
                if not key or key in known:
                    continue
                counter[key] += 1
                original_by_key.setdefault(key, skill)
        return [
            (original_by_key[key], count)
            for key, count in counter.most_common()
            if count >= min_count
        ]

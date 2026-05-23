from linkedln_scrapper.ranking.skill_gap import SkillGapAnalyzer
from linkedln_scrapper.storage.base import JobRepository


class TrendService:
    def __init__(self, job_repository: JobRepository, analyzer: SkillGapAnalyzer):
        self.job_repository = job_repository
        self.analyzer = analyzer

    def missing_skills(self, limit: int = 500, min_count: int = 2) -> list[tuple[str, int]]:
        jobs = self.job_repository.list_recent(limit=limit)
        return self.analyzer.missing_skill_counts(jobs, min_count=min_count)

from linkedln_scrapper.domain.models import JobPosting, JobRecommendation
from linkedln_scrapper.ranking.scorer import WeightedJobScorer
from linkedln_scrapper.storage.base import RecommendationRepository


class RankingService:
    def __init__(
        self,
        scorer: WeightedJobScorer,
        recommendation_repository: RecommendationRepository,
    ):
        self.scorer = scorer
        self.recommendation_repository = recommendation_repository

    def rank(self, job: JobPosting, run_id: str) -> JobRecommendation:
        recommendation = self.scorer.score(job, run_id=run_id)
        self.recommendation_repository.save(recommendation)
        return recommendation

import hashlib
from datetime import UTC, datetime, timedelta

from linkedln_scrapper.domain.enums import RecommendationDecision
from linkedln_scrapper.domain.models import JobPosting, JobRecommendation, ScoreBreakdown, UserProfile
from linkedln_scrapper.domain.scoring import ScoreWeights
from linkedln_scrapper.normalization.text import stable_term_key
from linkedln_scrapper.ranking.explanations import build_negative_reasons, build_positive_reasons
from linkedln_scrapper.ranking.matcher import ProfileMatcher, job_text
from linkedln_scrapper.ranking.profile import NormalizedProfile


class WeightedJobScorer:
    def __init__(
        self,
        profile: UserProfile,
        weights: ScoreWeights,
        send_threshold: float,
        hold_threshold: float,
    ):
        self.profile = profile
        self.weights = weights
        self.send_threshold = send_threshold
        self.hold_threshold = hold_threshold
        self.normalized_profile = NormalizedProfile(profile)
        self.matcher = ProfileMatcher(self.normalized_profile)

    def score(self, job: JobPosting, run_id: str) -> JobRecommendation:
        matched_skills = self.matcher.matched_skills(job)
        matched_stack = self.matcher.matched_preferred_stack(job)
        matched_interests = self.matcher.matched_interests(job)
        hard_negatives, soft_negatives = self.matcher.negative_terms(job)
        missing_skills = self.matcher.missing_relevant_skills(job)

        breakdown = ScoreBreakdown(
            title=self._title_score(job),
            skills=self._ratio_score(len(matched_skills), max(len(self.profile.resume.skills), 1), self.weights.skills),
            interests=self._interest_score(matched_interests),
            seniority=self._seniority_score(job),
            workplace=self._workplace_score(job),
            recency=self._recency_score(job),
            description_quality=self._description_quality_score(job),
            preferred_stack=self._ratio_score(
                len(matched_stack),
                max(len(self.profile.preferred_stack), 1),
                self.weights.preferred_stack,
            ),
            penalties=self._penalty_score(hard_negatives, soft_negatives, missing_skills),
        )
        score = max(0, min(100, breakdown.total))
        decision = self._decision(score, hard_negatives)

        return JobRecommendation(
            recommendation_id=self._recommendation_id(job.job_id, run_id),
            job_id=job.job_id,
            run_id=run_id,
            score=score,
            decision=decision,
            breakdown=breakdown,
            matched_skills=matched_skills,
            matched_interests=matched_interests,
            missing_skills=missing_skills,
            positive_reasons=build_positive_reasons(
                job=job,
                matched_skills=matched_skills,
                matched_stack=matched_stack,
                matched_interests=matched_interests,
            ),
            negative_reasons=build_negative_reasons(
                hard_negatives=hard_negatives,
                soft_negatives=soft_negatives,
                missing_skills=missing_skills,
            ),
        )

    def _title_score(self, job: JobPosting) -> float:
        title = stable_term_key(job.title)
        preferred_title_terms = {
            "backend",
            "platform",
            "infrastructure",
            "software engineer",
            "distributed",
            "data engineer",
        }
        hits = sum(1 for term in preferred_title_terms if term in title)
        return self._ratio_score(hits, 3, self.weights.title)

    def _interest_score(self, matched_interests: list[str]) -> float:
        strong = {stable_term_key(term) for term in self.profile.interests.strong}
        score = 0.0
        for interest in matched_interests:
            score += 0.65 if stable_term_key(interest) in strong else 0.35
        return min(self.weights.interests, score * self.weights.interests)

    def _seniority_score(self, job: JobPosting) -> float:
        preferred = self.profile.preferences.seniority
        if not preferred:
            return self.weights.seniority / 2
        if job.seniority in preferred:
            return self.weights.seniority
        if job.seniority.value == "unknown":
            return self.weights.seniority * 0.35
        return 0

    def _workplace_score(self, job: JobPosting) -> float:
        preferred = self.profile.preferences.workplace
        if not preferred:
            return self.weights.workplace / 2
        if job.workplace_type in preferred:
            return self.weights.workplace
        if job.workplace_type.value == "unknown":
            return self.weights.workplace * 0.35
        return 0

    def _recency_score(self, job: JobPosting) -> float:
        now = datetime.now(UTC)
        if job.posted_at and job.posted_at >= now - timedelta(days=3):
            return self.weights.recency
        if job.scraped_at >= now - timedelta(days=3):
            return self.weights.recency * 0.75
        return self.weights.recency * 0.25

    def _description_quality_score(self, job: JobPosting) -> float:
        text = job_text(job)
        if len(text) >= 1200:
            return self.weights.description_quality
        if len(text) >= 500:
            return self.weights.description_quality * 0.65
        if len(text) >= 150:
            return self.weights.description_quality * 0.35
        return 0

    def _penalty_score(
        self,
        hard_negatives: list[str],
        soft_negatives: list[str],
        missing_skills: list[str],
    ) -> float:
        return (
            len(hard_negatives) * self.weights.hard_negative_penalty
            + len(soft_negatives) * self.weights.soft_negative_penalty
            + min(len(missing_skills), 5) * self.weights.missing_skill_penalty
        )

    def _decision(self, score: float, hard_negatives: list[str]) -> RecommendationDecision:
        if hard_negatives:
            return RecommendationDecision.REJECT
        if score >= self.send_threshold:
            return RecommendationDecision.SEND
        if score >= self.hold_threshold:
            return RecommendationDecision.HOLD
        return RecommendationDecision.REJECT

    def _ratio_score(self, numerator: int, denominator: int, weight: float) -> float:
        return min(weight, (numerator / denominator) * weight)

    def _recommendation_id(self, job_id: str, run_id: str) -> str:
        return hashlib.sha256(f"{job_id}:{run_id}".encode("utf-8")).hexdigest()[:24]

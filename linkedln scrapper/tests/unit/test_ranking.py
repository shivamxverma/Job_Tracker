from linkedln_scrapper.config.loader import load_profile, load_settings, project_root
from linkedln_scrapper.domain.enums import RecommendationDecision
from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.normalization.normalizer import JobNormalizer
from linkedln_scrapper.ranking.scorer import WeightedJobScorer


def test_ranking_sends_high_signal_backend_job():
    root = project_root()
    settings = load_settings(root / "config" / "settings.yaml")
    profile = load_profile(root / "config" / "profile.yaml")

    raw = RawJob(
        job_url="https://www.linkedin.com/jobs/view/111/",
        title="Senior Backend Platform Engineer",
        company="Infra Co",
        location="Remote",
        description=(
            "Python FastAPI PostgreSQL Redis Kafka Docker AWS distributed systems "
            "platform engineering AI infrastructure observability."
        ),
    )
    job = JobNormalizer().normalize(raw)
    recommendation = WeightedJobScorer(
        profile=profile,
        weights=settings.ranking.weights,
        send_threshold=settings.ranking.send_threshold,
        hold_threshold=settings.ranking.hold_threshold,
    ).score(job, run_id="test-run")

    assert recommendation.decision == RecommendationDecision.SEND
    assert recommendation.score >= settings.ranking.send_threshold
    assert "Python" in recommendation.matched_skills
    assert recommendation.positive_reasons


def test_ranking_rejects_hard_negative_job():
    root = project_root()
    settings = load_settings(root / "config" / "settings.yaml")
    profile = load_profile(root / "config" / "profile.yaml")

    raw = RawJob(
        job_url="https://www.linkedin.com/jobs/view/222/",
        title="PHP WordPress Support Engineer",
        company="CMS Co",
        location="On-site",
        description="Customer support for WordPress and PHP websites.",
    )
    job = JobNormalizer().normalize(raw)
    recommendation = WeightedJobScorer(
        profile=profile,
        weights=settings.ranking.weights,
        send_threshold=settings.ranking.send_threshold,
        hold_threshold=settings.ranking.hold_threshold,
    ).score(job, run_id="test-run")

    assert recommendation.decision == RecommendationDecision.REJECT
    assert recommendation.negative_reasons

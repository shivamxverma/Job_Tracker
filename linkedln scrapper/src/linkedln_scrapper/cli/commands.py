import argparse
import asyncio
from pathlib import Path

from linkedln_scrapper.application.deduplication_service import DeduplicationService
from linkedln_scrapper.application.ingestion_service import JobIngestionService
from linkedln_scrapper.application.notification_service import NotificationService
from linkedln_scrapper.application.ranking_service import RankingService
from linkedln_scrapper.application.trend_service import TrendService
from linkedln_scrapper.config.loader import (
    load_profile,
    load_search_urls,
    load_secrets,
    load_settings,
    project_root,
)
from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.normalization.normalizer import JobNormalizer
from linkedln_scrapper.notifications.telegram import DryRunNotifier, TelegramNotifier
from linkedln_scrapper.observability.logging import configure_logging
from linkedln_scrapper.observability.run_context import new_run
from linkedln_scrapper.ranking.scorer import WeightedJobScorer
from linkedln_scrapper.ranking.skill_gap import SkillGapAnalyzer
from linkedln_scrapper.scraping.linkedin.scraper import LinkedInScraper
from linkedln_scrapper.storage.csv_repository import (
    CSVJobRepository,
    CSVNotificationRepository,
    CSVRecommendationRepository,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="linkedln-scrapper",
        description="Personal LinkedIn job intelligence pipeline.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Scrape, rank, store, and notify.")
    run_parser.add_argument("--dry-run", action="store_true", help="Print Telegram messages locally.")
    run_parser.add_argument("--headless", action="store_true", help="Run Playwright in headless mode.")

    subparsers.add_parser("rank-sample", help="Rank a built-in sample job without scraping.")
    subparsers.add_parser("trends", help="Print missing skill trends from stored CSV jobs.")
    subparsers.add_parser("schedule", help="Run the APScheduler loop.")
    return parser


def main() -> None:
    configure_logging()
    args = build_parser().parse_args()

    if args.command == "run":
        asyncio.run(run_pipeline(dry_run=args.dry_run, headless=args.headless))
    elif args.command == "rank-sample":
        rank_sample()
    elif args.command == "trends":
        show_trends()
    elif args.command == "schedule":
        from linkedln_scrapper.scheduler.apscheduler_runner import run_scheduler

        run_scheduler()


async def run_pipeline(dry_run: bool = False, headless: bool = False) -> None:
    root = project_root()
    settings = load_settings()
    profile = load_profile()
    secrets = load_secrets(root)
    run = new_run()
    csv_dir = _resolve_path(root, settings.storage.csv_dir)

    job_repository = CSVJobRepository(csv_dir)
    recommendation_repository = CSVRecommendationRepository(csv_dir)
    notification_repository = CSVNotificationRepository(csv_dir)

    scorer = WeightedJobScorer(
        profile=profile,
        weights=settings.ranking.weights,
        send_threshold=settings.ranking.send_threshold,
        hold_threshold=settings.ranking.hold_threshold,
    )

    notifier = _build_notifier(secrets, dry_run or settings.notifications.dry_run)
    service = JobIngestionService(
        scraper=LinkedInScraper(
            settings=settings.scraping,
            secrets=secrets,
            project_root=root,
            run_id=run.run_id,
            headless=headless,
        ),
        normalizer=JobNormalizer(),
        deduper=DeduplicationService(job_repository),
        job_repository=job_repository,
        ranking_service=RankingService(scorer, recommendation_repository),
        notification_service=NotificationService(
            notifier=notifier,
            notification_repository=notification_repository,
            max_per_run=settings.ranking.max_notifications_per_run,
        ),
    )
    search_urls = load_search_urls()
    completed = await service.run(search_urls=search_urls, run=run)
    print(
        "Run complete: "
        f"discovered={completed.jobs_discovered} "
        f"new={completed.jobs_new} "
        f"duplicates={completed.jobs_duplicate} "
        f"ranked={completed.jobs_ranked} "
        f"sent={completed.notifications_sent}"
    )


def rank_sample() -> None:
    root = project_root()
    settings = load_settings()
    profile = load_profile()
    run = new_run()

    raw = RawJob(
        job_url="https://www.linkedin.com/jobs/view/1234567890/",
        title="Senior Backend Platform Engineer",
        company="Example Infra",
        location="Remote",
        description=(
            "Build Python services with FastAPI, PostgreSQL, Redis, Kafka, Docker, "
            "Kubernetes, AWS, Terraform, and observability for AI infrastructure."
        ),
    )
    job = JobNormalizer().normalize(raw)
    csv_dir = _resolve_path(root, settings.storage.csv_dir)
    scorer = WeightedJobScorer(
        profile=profile,
        weights=settings.ranking.weights,
        send_threshold=settings.ranking.send_threshold,
        hold_threshold=settings.ranking.hold_threshold,
    )
    recommendation = RankingService(
        scorer,
        CSVRecommendationRepository(csv_dir),
    ).rank(job, run_id=run.run_id)

    print(f"Score: {recommendation.score:.0f}/100")
    print(f"Decision: {recommendation.decision.value}")
    print("Matched skills:", ", ".join(recommendation.matched_skills) or "none")
    print("Missing skills:", ", ".join(recommendation.missing_skills) or "none")
    print("Reasons:")
    for reason in recommendation.positive_reasons + recommendation.negative_reasons:
        print(f"- {reason}")


def show_trends() -> None:
    root = project_root()
    settings = load_settings()
    profile = load_profile()
    csv_dir = _resolve_path(root, settings.storage.csv_dir)
    service = TrendService(CSVJobRepository(csv_dir), SkillGapAnalyzer(profile))
    trends = service.missing_skills()
    if not trends:
        print("No missing skill trends yet. Run the pipeline or add jobs first.")
        return
    for skill, count in trends:
        print(f"{skill}: {count}")


def _build_notifier(secrets, dry_run: bool):
    if dry_run:
        return DryRunNotifier()
    if not secrets.telegram_bot_token or not secrets.telegram_chat_id:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Use --dry-run to skip sends.")
    return TelegramNotifier(secrets.telegram_bot_token, secrets.telegram_chat_id)


def _resolve_path(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path

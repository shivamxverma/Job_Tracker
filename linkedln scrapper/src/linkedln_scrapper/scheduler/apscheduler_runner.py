import asyncio

from apscheduler.schedulers.blocking import BlockingScheduler

from linkedln_scrapper.cli.commands import run_pipeline
from linkedln_scrapper.config.loader import load_settings


def run_scheduler() -> None:
    settings = load_settings()
    scheduler = BlockingScheduler()

    scheduler.add_job(
        lambda: asyncio.run(run_pipeline()),
        "interval",
        minutes=settings.scheduler.interval_minutes,
        id="linkedln-job-intelligence",
        max_instances=1,
        coalesce=True,
    )

    print(f"Scheduler started. Interval: {settings.scheduler.interval_minutes} minutes.")
    scheduler.start()

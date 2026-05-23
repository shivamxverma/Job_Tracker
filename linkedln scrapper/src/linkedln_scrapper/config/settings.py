from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from linkedln_scrapper.domain.scoring import ScoreWeights


class AppSettings(BaseModel):
    name: str = "linkedln-scrapper"
    environment: str = "local"


class StorageSettings(BaseModel):
    backend: str = "csv"
    csv_dir: Path = Path("data/csv")


class ScrapingSettings(BaseModel):
    max_detail_concurrency: int = 3
    max_jobs_per_search: int = 30
    max_scroll_attempts: int = 8
    page_timeout_ms: int = 45_000
    min_delay_seconds: float = 2.0
    max_delay_seconds: float = 7.0
    snapshot_on_error: bool = True
    snapshot_sample_rate: float = 0.05
    selectors_path: Path = Path("config/selectors/linkedin_jobs.yaml")


class RankingSettings(BaseModel):
    send_threshold: float = 75
    hold_threshold: float = 60
    max_notifications_per_run: int = 5
    weights: ScoreWeights = Field(default_factory=ScoreWeights)


class SchedulerSettings(BaseModel):
    enabled: bool = False
    interval_minutes: int = 180


class NotificationSettings(BaseModel):
    telegram_enabled: bool = True
    dry_run: bool = False


class Settings(BaseModel):
    app: AppSettings = Field(default_factory=AppSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    scraping: ScrapingSettings = Field(default_factory=ScrapingSettings)
    ranking: RankingSettings = Field(default_factory=RankingSettings)
    scheduler: SchedulerSettings = Field(default_factory=SchedulerSettings)
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)


class SecretSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    linkedin_storage_state: Path | None = None
    linkedin_user_data_dir: Path | None = None

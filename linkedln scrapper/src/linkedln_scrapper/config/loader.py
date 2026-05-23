from pathlib import Path
from typing import Any

import yaml

from linkedln_scrapper.config.settings import SecretSettings, Settings
from linkedln_scrapper.domain.models import UserProfile


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def read_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping in YAML file: {path}")
    return data


def load_settings(path: Path | None = None) -> Settings:
    root = project_root()
    settings_path = path or root / "config" / "settings.yaml"
    return Settings.model_validate(read_yaml(settings_path))


def load_profile(path: Path | None = None) -> UserProfile:
    root = project_root()
    profile_path = path or root / "config" / "profile.yaml"
    return UserProfile.model_validate(read_yaml(profile_path))


def load_search_urls(path: Path | None = None) -> list[str]:
    root = project_root()
    searches_path = path or root / "config" / "linkedin_searches.yaml"
    data = read_yaml(searches_path)
    searches = data.get("searches", [])
    urls: list[str] = []
    for search in searches:
        if not isinstance(search, dict):
            continue
        if search.get("enabled", True) and search.get("url"):
            urls.append(str(search["url"]))
    return urls


def load_secrets(root: Path | None = None) -> SecretSettings:
    env_root = root or project_root()
    secrets = SecretSettings(_env_file=env_root / ".env")
    if secrets.linkedin_storage_state and not secrets.linkedin_storage_state.is_absolute():
        secrets.linkedin_storage_state = env_root / secrets.linkedin_storage_state
    if secrets.linkedin_user_data_dir and not secrets.linkedin_user_data_dir.is_absolute():
        secrets.linkedin_user_data_dir = env_root / secrets.linkedin_user_data_dir
    return secrets

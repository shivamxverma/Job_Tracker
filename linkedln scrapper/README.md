# LinkedIn Job Intelligence

This is a production-minded V1 scaffold for a personal LinkedIn job intelligence system.
It is intentionally a modular monolith: one Python project, clear interfaces, CSV storage first,
and PostgreSQL/Celery/AI integration points later.

The project directory keeps the requested spelling: `linkedln scrapper`.
The importable Python package is `linkedln_scrapper`.

## What exists in V1

- Async Playwright scraper boundaries for LinkedIn search and detail pages.
- Selector registry backed by YAML so LinkedIn selector drift is isolated.
- HTML snapshot storage for debugging failed extraction.
- Pydantic domain models for jobs, recommendations, runs, and profile data.
- CSV repositories with dedupe and notification history.
- Explainable weighted ranking engine.
- Telegram notification adapter.
- APScheduler runner.
- Unit-testable normalization, dedupe, and ranking modules.

## Setup

```bash
cd "linkedln scrapper"
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
playwright install chromium
cp .env.example .env
```

Then edit:

- `config/profile.yaml`
- `config/linkedin_searches.yaml`
- `.env`

## Commands

Run a full scrape/rank/notify pipeline:

```bash
linkedln-scrapper run
```

Run without Telegram sends:

```bash
linkedln-scrapper run --dry-run
```

Rank a built-in sample job without touching LinkedIn:

```bash
linkedln-scrapper rank-sample
```

Generate a skill trend report from stored jobs:

```bash
linkedln-scrapper trends
```

Run on a schedule:

```bash
linkedln-scrapper schedule
```

## Notes

LinkedIn automation should stay low-volume and personal. This scaffold includes conservative
rate limiting, persistent browser sessions, snapshot-based debugging, and a circuit breaker for
login/checkpoint/CAPTCHA-like pages. It does not include CAPTCHA solving, fingerprint bypasses,
or bulk collection workflows.

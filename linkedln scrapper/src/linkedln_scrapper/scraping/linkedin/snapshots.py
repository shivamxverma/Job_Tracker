import hashlib
from datetime import UTC, datetime
from pathlib import Path


class SnapshotStore:
    def __init__(self, root: Path):
        self.html_dir = root / "html"
        self.screenshot_dir = root / "screenshots"
        self.html_dir.mkdir(parents=True, exist_ok=True)
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)

    async def save_page(self, page, url: str, run_id: str, reason: str) -> str:
        safe_reason = "".join(char if char.isalnum() else "-" for char in reason.lower()).strip("-")
        url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        stem = f"{timestamp}-{run_id}-{safe_reason}-{url_hash}"

        html_path = self.html_dir / f"{stem}.html"
        html_path.write_text(await page.content(), encoding="utf-8")

        screenshot_path = self.screenshot_dir / f"{stem}.png"
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True)
        except Exception:
            pass
        return str(html_path)

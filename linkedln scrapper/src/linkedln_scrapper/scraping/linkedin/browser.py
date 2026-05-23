from pathlib import Path


class BrowserManager:
    def __init__(
        self,
        user_data_dir: Path | None,
        storage_state: Path | None,
        headless: bool = False,
        timeout_ms: int = 45_000,
    ):
        self.user_data_dir = user_data_dir
        self.storage_state = storage_state
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.playwright = None
        self.context = None

    async def start(self):
        from playwright.async_api import async_playwright

        self.playwright = await async_playwright().start()

        if self.user_data_dir:
            self.user_data_dir.mkdir(parents=True, exist_ok=True)
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                viewport={"width": 1440, "height": 1000},
                slow_mo=50,
            )
        else:
            browser = await self.playwright.chromium.launch(headless=self.headless)
            kwargs = {"viewport": {"width": 1440, "height": 1000}}
            if self.storage_state and self.storage_state.exists():
                kwargs["storage_state"] = str(self.storage_state)
            self.context = await browser.new_context(**kwargs)

        self.context.set_default_timeout(self.timeout_ms)
        return self.context

    async def new_page(self):
        if self.context is None:
            await self.start()
        return await self.context.new_page()

    async def close(self) -> None:
        if self.context is not None:
            await self.context.close()
            self.context = None
        if self.playwright is not None:
            await self.playwright.stop()
            self.playwright = None

import asyncio
import random


class RateLimiter:
    def __init__(self, min_delay_seconds: float, max_delay_seconds: float):
        self.min_delay_seconds = min_delay_seconds
        self.max_delay_seconds = max_delay_seconds

    async def wait(self) -> None:
        delay = random.uniform(self.min_delay_seconds, self.max_delay_seconds)
        await asyncio.sleep(delay)

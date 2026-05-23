from typing import Protocol


class Notifier(Protocol):
    async def send_message(self, message: str) -> None:
        ...

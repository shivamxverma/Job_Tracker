from pathlib import Path

import yaml


class SelectorRegistry:
    def __init__(self, selectors: dict):
        self.selectors = selectors

    @classmethod
    def from_yaml(cls, path: Path) -> "SelectorRegistry":
        with path.open("r", encoding="utf-8") as file:
            data = yaml.safe_load(file) or {}
        return cls(data)

    def all(self, *path: str) -> list[str]:
        node = self.selectors
        for part in path:
            node = node.get(part, {})
        if isinstance(node, list):
            return [str(selector) for selector in node]
        if isinstance(node, str):
            return [node]
        return []

    def first(self, *path: str) -> str | None:
        selectors = self.all(*path)
        return selectors[0] if selectors else None

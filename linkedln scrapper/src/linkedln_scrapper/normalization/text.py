import re
import unicodedata


WHITESPACE_RE = re.compile(r"\s+")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKC", value)
    return WHITESPACE_RE.sub(" ", normalized).strip()


def contains_any(text: str, terms: set[str] | list[str]) -> list[str]:
    haystack = text.casefold()
    matches: list[str] = []
    for term in terms:
        needle = clean_text(term).casefold()
        if not needle:
            continue
        if needle in haystack:
            matches.append(term)
    return matches


def stable_term_key(value: str) -> str:
    return clean_text(value).casefold()

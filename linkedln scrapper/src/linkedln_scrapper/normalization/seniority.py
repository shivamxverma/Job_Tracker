from linkedln_scrapper.domain.enums import Seniority
from linkedln_scrapper.normalization.text import clean_text


def infer_seniority(title: str | None, description: str | None = None) -> Seniority:
    text = f"{clean_text(title)} {clean_text(description)}".casefold()
    if any(term in text for term in ("intern", "internship")):
        return Seniority.INTERN
    if any(term in text for term in ("junior", "entry level", "entry-level", "graduate")):
        return Seniority.JUNIOR
    if any(term in text for term in ("staff", "principal")):
        return Seniority.STAFF
    if any(term in text for term in ("lead", "tech lead")):
        return Seniority.LEAD
    if any(term in text for term in ("manager", "head of", "director")):
        return Seniority.MANAGER
    if any(term in text for term in ("senior", "sr.", "sr ")):
        return Seniority.SENIOR
    if any(term in text for term in ("software engineer", "backend engineer", "platform engineer")):
        return Seniority.MID
    return Seniority.UNKNOWN

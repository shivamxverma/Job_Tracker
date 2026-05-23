from linkedln_scrapper.domain.enums import WorkplaceType
from linkedln_scrapper.normalization.text import clean_text


def infer_workplace_type(location: str | None, description: str | None = None) -> WorkplaceType:
    text = f"{clean_text(location)} {clean_text(description)}".casefold()
    if "remote" in text or "work from home" in text or "wfh" in text:
        return WorkplaceType.REMOTE
    if "hybrid" in text:
        return WorkplaceType.HYBRID
    if "on-site" in text or "onsite" in text or "office" in text:
        return WorkplaceType.ONSITE
    return WorkplaceType.UNKNOWN

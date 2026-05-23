from linkedln_scrapper.domain.models import JobPosting, JobRecommendation


def format_telegram_message(job: JobPosting, recommendation: JobRecommendation) -> str:
    positive = "\n".join(f"- {reason}" for reason in recommendation.positive_reasons[:4])
    negative = "\n".join(f"- {reason}" for reason in recommendation.negative_reasons[:2])
    missing = ", ".join(recommendation.missing_skills[:6]) or "None detected"

    parts = [
        f"{job.title} - {job.company}",
        f"Score: {recommendation.score:.0f}/100",
        f"Location: {job.location or 'Unknown'}",
        f"Workplace: {job.workplace_type.value}",
        f"Seniority: {job.seniority.value}",
        "",
        "Why it matched:",
        positive or "- Strong enough aggregate profile match.",
        "",
        f"Missing skills: {missing}",
    ]

    if negative:
        parts.extend(["", "Cautions:", negative])

    parts.extend(["", f"Apply: {job.canonical_url}"])
    return "\n".join(parts)

from linkedln_scrapper.domain.models import JobPosting


def build_positive_reasons(
    job: JobPosting,
    matched_skills: list[str],
    matched_stack: list[str],
    matched_interests: list[str],
) -> list[str]:
    reasons: list[str] = []
    if matched_skills:
        reasons.append(f"Matches your resume skills: {', '.join(matched_skills[:6])}.")
    if matched_stack:
        reasons.append(f"Uses preferred stack signals: {', '.join(matched_stack[:6])}.")
    if matched_interests:
        reasons.append(f"Aligns with interests: {', '.join(matched_interests[:4])}.")
    if job.seniority.value != "unknown":
        reasons.append(f"Seniority inferred as {job.seniority.value}.")
    if job.workplace_type.value in {"remote", "hybrid"}:
        reasons.append(f"Workplace appears {job.workplace_type.value}.")
    return reasons


def build_negative_reasons(
    hard_negatives: list[str],
    soft_negatives: list[str],
    missing_skills: list[str],
) -> list[str]:
    reasons: list[str] = []
    if hard_negatives:
        reasons.append(f"Hard negative terms found: {', '.join(hard_negatives)}.")
    if soft_negatives:
        reasons.append(f"Soft negative terms found: {', '.join(soft_negatives)}.")
    if missing_skills:
        reasons.append(f"Potential missing skills: {', '.join(missing_skills[:6])}.")
    return reasons

from linkedln_scrapper.normalization.text import clean_text


DEFAULT_SKILL_VOCABULARY: tuple[str, ...] = (
    "Python",
    "Go",
    "Java",
    "JavaScript",
    "TypeScript",
    "FastAPI",
    "Django",
    "Flask",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Kafka",
    "RabbitMQ",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "Terraform",
    "Ansible",
    "Airflow",
    "Spark",
    "Flink",
    "Elasticsearch",
    "OpenSearch",
    "Prometheus",
    "Grafana",
    "OpenTelemetry",
    "LangChain",
    "LLM",
    "Embeddings",
    "Vector Database",
    "Microservices",
    "Distributed Systems",
    "REST",
    "GraphQL",
    "CI/CD",
)


def extract_known_skills(text: str, vocabulary: tuple[str, ...] = DEFAULT_SKILL_VOCABULARY) -> list[str]:
    haystack = f" {clean_text(text).casefold()} "
    found: list[str] = []
    seen: set[str] = set()
    for skill in vocabulary:
        key = skill.casefold()
        if key in seen:
            continue
        if f" {key} " in haystack or key in haystack:
            found.append(skill)
            seen.add(key)
    return found


def merge_skills(*skill_groups: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for group in skill_groups:
        for skill in group:
            cleaned = clean_text(skill)
            key = cleaned.casefold()
            if not cleaned or key in seen:
                continue
            seen.add(key)
            merged.append(cleaned)
    return merged

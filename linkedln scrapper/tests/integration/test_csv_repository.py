from linkedln_scrapper.domain.models import RawJob
from linkedln_scrapper.normalization.normalizer import JobNormalizer
from linkedln_scrapper.storage.csv_repository import CSVJobRepository


def test_csv_repository_upserts_and_finds_duplicate(tmp_path):
    repository = CSVJobRepository(tmp_path)
    raw = RawJob(
        job_url="https://www.linkedin.com/jobs/view/123/",
        title="Backend Engineer",
        company="Example",
        location="Remote",
        description="Python PostgreSQL backend role.",
    )
    job = JobNormalizer().normalize(raw)

    repository.upsert(job)

    duplicate = repository.find_duplicate(job)
    assert duplicate is not None
    assert duplicate.job_id == job.job_id
    assert len(repository.list_recent()) == 1

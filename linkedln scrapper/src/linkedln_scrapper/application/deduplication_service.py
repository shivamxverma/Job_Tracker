from linkedln_scrapper.domain.models import JobPosting
from linkedln_scrapper.storage.base import JobRepository


class DeduplicationService:
    def __init__(self, job_repository: JobRepository):
        self.job_repository = job_repository

    def is_duplicate(self, job: JobPosting) -> bool:
        return self.job_repository.find_duplicate(job) is not None

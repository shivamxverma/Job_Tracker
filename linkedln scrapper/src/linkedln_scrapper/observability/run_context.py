from uuid import uuid4

from linkedln_scrapper.domain.models import IngestionRun


def new_run() -> IngestionRun:
    return IngestionRun(run_id=str(uuid4()))

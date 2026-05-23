import logging
import sys


class RunIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "run_id"):
            record.run_id = "-"
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RunIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s run_id=%(run_id)s %(message)s")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))


class RunLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):  # type: ignore[no-untyped-def]
        extra = kwargs.setdefault("extra", {})
        extra.setdefault("run_id", self.extra.get("run_id", "-"))
        return msg, kwargs


def get_run_logger(name: str, run_id: str | None = None) -> RunLoggerAdapter:
    return RunLoggerAdapter(logging.getLogger(name), {"run_id": run_id or "-"})

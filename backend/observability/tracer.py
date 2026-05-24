import json
import time
import uuid
from datetime import datetime


class PipelineTrace:
    """A complete trace for one job execution."""

    def __init__(self, job_id: str, prompt: str):
        self.trace_id = str(uuid.uuid4())[:8]
        self.job_id = job_id
        self.prompt = prompt
        self.started_at = time.time()
        self.spans: list = []

    def add_span(
        self,
        name: str,
        status: str,
        duration_ms: int,
        metadata: dict = None,
    ):
        span = {
            "span_id": str(uuid.uuid4())[:8],
            "name": name,
            "status": status,
            "duration_ms": duration_ms,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }
        self.spans.append(span)

        print(
            json.dumps(
                {
                    "level": "INFO" if status == "success" else "WARN",
                    "trace_id": self.trace_id,
                    "job_id": self.job_id,
                    "span": name,
                    "status": status,
                    "duration_ms": duration_ms,
                    **(metadata or {}),
                }
            )
        )

    def to_dict(self) -> dict:
        total_ms = int((time.time() - self.started_at) * 1000)
        return {
            "trace_id": self.trace_id,
            "job_id": self.job_id,
            "total_duration_ms": total_ms,
            "span_count": len(self.spans),
            "spans": self.spans,
        }

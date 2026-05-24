import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

load_dotenv(dotenv_path=ENV_PATH)

try:
    from celery import Celery
except Exception:  # pragma: no cover - local fallback in main handles missing celery
    Celery = None


celery_broker_url = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
celery_app = (
    Celery(
        "prompt_to_reel",
        broker=celery_broker_url,
        backend=celery_broker_url,
    )
    if Celery is not None
    else None
)

if celery_app is not None:
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )


def _run_pipeline_task(job_id, request_dict):
    from main import generate_video_pipeline

    d = request_dict or {}
    generate_video_pipeline(
        d.get("prompt", ""),
        job_id,
        d.get("user_id"),
        d.get("orientation", "portrait"),
        d.get("footage_ids", []),
        d.get("export_formats", []),
        d.get("apply_brand_kit", True),
        d.get("transition_style", "auto"),
    )


if celery_app is not None:

    @celery_app.task(name="process_film_job")
    def process_film_job(job_id, request_dict):
        _run_pipeline_task(job_id, request_dict)


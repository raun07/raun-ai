web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 2
worker: celery -A backend.worker worker --concurrency=2

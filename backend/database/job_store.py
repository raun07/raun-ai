import json
import logging
import os
import time

try:
    import redis
except Exception:  # pragma: no cover - local fallback handles missing dependency
    redis = None

DEFAULT_TTL_SECONDS = 3600
_memory_jobs = {}
_redis_client = None
_using_memory_fallback = False


def init_job_store():
    global _redis_client, _using_memory_fallback

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        _using_memory_fallback = True
        logging.warning("[JobStore] REDIS_URL not set. Falling back to in-memory job storage.")
        return

    if redis is None:
        _using_memory_fallback = True
        logging.warning("[JobStore] redis package unavailable. Falling back to in-memory job storage.")
        return

    try:
        _redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        _using_memory_fallback = False
        logging.info("[JobStore] Connected to Redis job storage")
    except Exception as exc:
        _redis_client = None
        _using_memory_fallback = True
        logging.warning(f"[JobStore] Redis unavailable ({exc}). Falling back to in-memory job storage.")


def close_job_store():
    global _redis_client
    try:
        if _redis_client is not None:
            _redis_client.close()
    except Exception as exc:
        logging.warning(f"[JobStore] Failed to close Redis connection cleanly: {exc}")
    finally:
        _redis_client = None


def using_memory_fallback():
    return _using_memory_fallback


def set_job(job_id, data, ttl=DEFAULT_TTL_SECONDS):
    payload = dict(data or {})

    if _redis_client is not None and not _using_memory_fallback:
        try:
            _redis_client.setex(f"job:{job_id}", ttl, json.dumps(payload))
            return payload
        except Exception as exc:
            logging.warning(f"[JobStore] Redis set_job failed for {job_id}: {exc}. Falling back to memory.")

    _memory_jobs[job_id] = {"data": payload, "expires_at": time.time() + ttl}
    return payload


def get_job(job_id):
    if _redis_client is not None and not _using_memory_fallback:
        try:
            raw = _redis_client.get(f"job:{job_id}")
            return json.loads(raw) if raw else None
        except Exception as exc:
            logging.warning(f"[JobStore] Redis get_job failed for {job_id}: {exc}. Falling back to memory.")

    entry = _memory_jobs.get(job_id)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        _memory_jobs.pop(job_id, None)
        return None
    return dict(entry["data"])


def update_job(job_id, updates, ttl=DEFAULT_TTL_SECONDS):
    current = get_job(job_id)
    if current is None:
        return None

    merged = dict(current)
    merged.update(dict(updates or {}))
    return set_job(job_id, merged, ttl=ttl)


def delete_job(job_id):
    if _redis_client is not None and not _using_memory_fallback:
        try:
            _redis_client.delete(f"job:{job_id}")
        except Exception as exc:
            logging.warning(f"[JobStore] Redis delete_job failed for {job_id}: {exc}")

    _memory_jobs.pop(job_id, None)


def cleanup_expired_jobs():
    now = time.time()
    expired_keys = [job_id for job_id, entry in _memory_jobs.items() if entry["expires_at"] <= now]
    for job_id in expired_keys:
        _memory_jobs.pop(job_id, None)


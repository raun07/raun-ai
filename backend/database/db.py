import logging
import os

import asyncpg

from database.models import ensure_schema


logger = logging.getLogger(__name__)

_pool = None


def _database_url():
    return os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")


def get_pool():
    return _pool


async def init_db():
    global _pool
    if _pool is not None:
        return _pool

    database_url = _database_url()
    if not database_url:
        logger.warning("[Database] SUPABASE_DB_URL not set; asyncpg pool disabled")
        return None

    try:
        _pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
        logger.info("[Database] asyncpg pool initialized")
        await ensure_schema(_pool)
    except Exception as exc:
        _pool = None
        logger.exception("[Database] Failed to initialize asyncpg pool: %s", exc)

    return _pool


async def close_db():
    global _pool

    if _pool is None:
        return

    try:
        await _pool.close()
        logger.info("[Database] asyncpg pool closed")
    except Exception as exc:
        logger.exception("[Database] Failed to close asyncpg pool: %s", exc)
    finally:
        _pool = None

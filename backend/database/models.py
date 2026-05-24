import logging


logger = logging.getLogger(__name__)


SCHEMA_STATEMENTS = [
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        tier TEXT DEFAULT 'free',
        credits INTEGER DEFAULT 30,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id),
        job_id TEXT UNIQUE,
        prompt TEXT,
        title TEXT,
        mood TEXT,
        video_url TEXT,
        duration INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS brand_kits (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        logo_url TEXT,
        outro_clip_url TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    """,
]


async def ensure_schema(pool):
    if pool is None:
        logger.warning("[Database] Skipping schema setup because no pool is available")
        return

    try:
        async with pool.acquire() as connection:
            for statement in SCHEMA_STATEMENTS:
                await connection.execute(statement)
        logger.info("[Database] Schema ensured successfully")
    except Exception as exc:
        logger.exception("[Database] Failed to ensure schema: %s", exc)

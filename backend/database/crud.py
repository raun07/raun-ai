import logging
import threading

from database.db import get_pool


logger = logging.getLogger(__name__)


def _is_background_thread_error(exc: Exception) -> bool:
    """
    True when a DB error should be treated as non-critical.
    Covers: asyncpg loop-mismatch RuntimeErrors, asyncpg InterfaceErrors
    during connection release, and any DB error raised from a non-main thread
    (pipeline threads — these are analytics calls, never critical to generation).
    """
    if threading.current_thread() is not threading.main_thread():
        return True
    msg = str(exc)
    return isinstance(exc, RuntimeError) and (
        "different loop" in msg or "attached" in msg
    )


def _log_db_error(operation: str, exc: Exception) -> None:
    if _is_background_thread_error(exc):
        logger.warning(
            "[Database] Skipping %s from background thread — not critical: %s",
            operation, type(exc).__name__,
        )
    else:
        logger.exception("[Database] %s failed: %s", operation, exc)


async def get_or_create_user(user_id, email=None):
    pool = get_pool()
    default_user = {"id": user_id, "email": email, "tier": "free", "credits": 30}

    if pool is None:
        logger.warning("[Database] get_or_create_user fallback for %s; no pool available", user_id)
        return default_user

    try:
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                INSERT INTO users (id, email)
                VALUES ($1, $2)
                ON CONFLICT (id)
                DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
                RETURNING id, email, tier, credits;
                """,
                user_id,
                email,
            )
            return dict(row)
    except Exception as exc:
        _log_db_error(f"get_or_create_user({user_id})", exc)
        return default_user


async def create_generation(user_id, job_id, prompt):
    pool = get_pool()
    payload = {"user_id": user_id, "job_id": job_id, "prompt": prompt, "status": "pending"}

    if pool is None:
        logger.warning("[Database] create_generation skipped for %s; no pool available", job_id)
        return payload

    try:
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                INSERT INTO generations (user_id, job_id, prompt)
                VALUES ($1, $2, $3)
                RETURNING id, user_id, job_id, prompt, status, created_at;
                """,
                user_id,
                job_id,
                prompt,
            )
            return dict(row)
    except Exception as exc:
        _log_db_error(f"create_generation({job_id})", exc)
        return payload


async def update_generation(job_id, video_url=None, status=None, title=None, mood=None, duration=None):
    pool = get_pool()
    payload = {
        "job_id": job_id,
        "video_url": video_url,
        "status": status,
        "title": title,
        "mood": mood,
        "duration": duration,
    }

    if pool is None:
        logger.warning("[Database] update_generation skipped for %s; no pool available", job_id)
        return payload

    try:
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE generations
                SET
                    video_url = COALESCE($2, video_url),
                    status = COALESCE($3, status),
                    title = COALESCE($4, title),
                    mood = COALESCE($5, mood),
                    duration = COALESCE($6, duration)
                WHERE job_id = $1
                RETURNING id, user_id, job_id, prompt, title, mood, video_url, duration, status, created_at;
                """,
                job_id,
                video_url,
                status,
                title,
                mood,
                duration,
            )
            return dict(row) if row else payload
    except Exception as exc:
        _log_db_error(f"update_generation({job_id})", exc)
        return payload


async def get_user_generations(user_id, limit=20):
    pool = get_pool()

    if pool is None:
        logger.warning("[Database] get_user_generations fallback for %s; no pool available", user_id)
        return []

    try:
        async with pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT job_id, prompt, video_url, created_at, status, title, mood, duration
                FROM generations
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2;
                """,
                user_id,
                limit,
            )
            return [dict(row) for row in rows]
    except Exception as exc:
        _log_db_error(f"get_user_generations({user_id})", exc)
        return []


async def get_user_credits(user_id):
    pool = get_pool()

    if pool is None:
        logger.warning("[Database] get_user_credits fallback for %s; no pool available", user_id)
        return 30

    try:
        async with pool.acquire() as connection:
            credits = await connection.fetchval(
                "SELECT credits FROM users WHERE id = $1;",
                user_id,
            )
            return credits if credits is not None else 30
    except Exception as exc:
        _log_db_error(f"get_user_credits({user_id})", exc)
        return 30


async def decrement_credits(user_id):
    pool = get_pool()

    if pool is None:
        logger.warning("[Database] decrement_credits skipped for %s; no pool available", user_id)
        return 30

    try:
        async with pool.acquire() as connection:
            credits = await connection.fetchval(
                """
                UPDATE users
                SET credits = GREATEST(credits - 1, 0)
                WHERE id = $1
                RETURNING credits;
                """,
                user_id,
            )
            return credits if credits is not None else 30
    except Exception as exc:
        _log_db_error(f"decrement_credits({user_id})", exc)
        return 30


async def get_brand_kit(user_id):
    pool = get_pool()
    default = {"user_id": user_id, "logo_url": None, "outro_clip_url": None}

    if pool is None:
        return default

    try:
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                "SELECT user_id, logo_url, outro_clip_url FROM brand_kits WHERE user_id = $1;",
                user_id,
            )
            return dict(row) if row else default
    except Exception as exc:
        _log_db_error(f"get_brand_kit({user_id})", exc)
        return default


async def save_brand_kit(user_id, logo_url=None, outro_clip_url=None):
    pool = get_pool()
    default = {"user_id": user_id, "logo_url": logo_url, "outro_clip_url": outro_clip_url}

    if pool is None:
        return default

    try:
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                INSERT INTO brand_kits (user_id, logo_url, outro_clip_url)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    logo_url = COALESCE(EXCLUDED.logo_url, brand_kits.logo_url),
                    outro_clip_url = COALESCE(EXCLUDED.outro_clip_url, brand_kits.outro_clip_url)
                RETURNING user_id, logo_url, outro_clip_url;
                """,
                user_id,
                logo_url,
                outro_clip_url,
            )
            return dict(row) if row else default
    except Exception as exc:
        _log_db_error(f"save_brand_kit({user_id})", exc)
        return default


async def add_credits(user_id, amount):
    pool = get_pool()

    if pool is None:
        logger.warning("[Database] add_credits skipped for %s; no pool available", user_id)
        return amount

    try:
        async with pool.acquire() as connection:
            credits = await connection.fetchval(
                """
                UPDATE users
                SET credits = credits + $2
                WHERE id = $1
                RETURNING credits;
                """,
                user_id,
                amount,
            )
            return credits if credits is not None else amount
    except Exception as exc:
        _log_db_error(f"add_credits({user_id})", exc)
        return amount

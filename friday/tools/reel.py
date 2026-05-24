import asyncio
import os

import httpx

REEL_API_BASE = os.getenv("REEL_API_URL", "http://localhost:8000")

_TOOLS = []


def _tool(func):
    _TOOLS.append(func)
    return func


def _auth_headers(token: str | None = None) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    api_key = os.getenv("REEL_API_KEY")
    if api_key:
        return {"Authorization": f"Bearer {api_key}"}
    return {}


@_tool
async def generate_reel(
    prompt: str,
    orientation: str = "portrait",
    token: str | None = None,
) -> str:
    """
    Start generating a reel from a text prompt.
    Returns the job_id to track progress with check_reel_status.
    orientation: 'portrait' (9:16), 'landscape' (16:9), or 'square' (1:1).
    """
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(
                f"{REEL_API_BASE}/generate",
                json={"prompt": prompt, "orientation": orientation},
                headers=_auth_headers(token),
            )
            data = r.json()
            if r.status_code == 402:
                return "You've used all free credits. Visit /pricing to upgrade."
            if not r.is_success:
                return f"Failed to start generation: {data.get('detail') or data.get('message') or r.status_code}"
            job_id = data.get("job_id")
            return f"Reel generation started! Job ID: {job_id}. Use check_reel_status('{job_id}') to track progress."
        except httpx.RequestError as e:
            return f"Could not reach the reel API: {e}"


@_tool
async def check_reel_status(job_id: str, token: str | None = None) -> str:
    """
    Check the current status of a reel generation job.
    Returns a human-readable summary including progress percentage.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(
                f"{REEL_API_BASE}/status/{job_id}",
                headers=_auth_headers(token),
            )
            if r.status_code == 404:
                return f"Job {job_id} not found."
            data = r.json()
            status = data.get("status", "unknown")
            progress = data.get("progress", 0)
            message = data.get("message", "")
            if status in ("completed", "rendering_complete"):
                video_url = data.get("video_url") or data.get("local_video_url", "")
                return f"Reel is ready! ({progress}%) {message}. Watch it here: {video_url}"
            if status == "failed":
                return f"Generation failed: {data.get('error') or 'unknown error'}"
            return f"Status: {status} — {progress}% — {message}"
        except httpx.RequestError as e:
            return f"Could not reach the reel API: {e}"


@_tool
async def wait_for_reel(
    job_id: str,
    timeout_seconds: int = 300,
    token: str | None = None,
) -> str:
    """
    Wait for a reel to finish generating and return its URL.
    Polls every 5 seconds up to timeout_seconds.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        elapsed = 0
        while elapsed < timeout_seconds:
            await asyncio.sleep(5)
            elapsed += 5
            try:
                r = await client.get(
                    f"{REEL_API_BASE}/status/{job_id}",
                    headers=_auth_headers(token),
                )
                data = r.json()
                status = data.get("status")
                if status in ("completed", "rendering_complete"):
                    video_url = data.get("video_url") or data.get("local_video_url", "")
                    return f"Your reel is ready! Watch it here: {video_url}"
                if status == "failed":
                    return f"Generation failed: {data.get('error') or 'unknown error'}"
            except httpx.RequestError:
                pass
        return f"Timed out after {timeout_seconds}s waiting for job {job_id}. Use check_reel_status to check manually."


@_tool
async def list_my_reels(limit: int = 10, token: str | None = None) -> str:
    """
    List the user's most recent reel generations.
    Returns titles, prompts, and video URLs.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(
                f"{REEL_API_BASE}/user/generations",
                headers=_auth_headers(token),
            )
            if not r.is_success:
                return "Could not fetch reel history."
            items = r.json().get("items", [])[:limit]
            if not items:
                return "No reels generated yet. Use generate_reel to make your first one!"
            lines = [f"Your last {len(items)} reel(s):"]
            for item in items:
                title = item.get("title") or item.get("prompt", "Untitled")[:60]
                url = item.get("video_url", "")
                status = item.get("status", "")
                lines.append(f"• {title} [{status}]{' — ' + url if url else ''}")
            return "\n".join(lines)
        except httpx.RequestError as e:
            return f"Could not reach the reel API: {e}"


@_tool
async def get_content_ideas(
    niche: str,
    platform: str = "instagram",
    count: int = 5,
    token: str | None = None,
) -> str:
    """
    Get AI-generated content ideas for a niche and platform.
    niche: e.g. 'fitness', 'cooking', 'travel'.
    platform: 'instagram', 'tiktok', 'youtube'.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(
                f"{REEL_API_BASE}/ideas",
                json={"niche": niche, "platform": platform, "count": min(count, 10)},
                headers=_auth_headers(token),
            )
            ideas = r.json().get("ideas", [])
            if not ideas:
                return f"No ideas returned for niche '{niche}'."
            numbered = "\n".join(f"{i + 1}. {idea}" for i, idea in enumerate(ideas))
            return f"Content ideas for {niche} on {platform}:\n{numbered}"
        except httpx.RequestError as e:
            return f"Could not reach the reel API: {e}"

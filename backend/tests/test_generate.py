import sys
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

for candidate in (str(REPO_ROOT), str(BACKEND_DIR)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

try:
    from backend.main import app
    from backend.main import get_current_user
    import backend.main as main_module
except ModuleNotFoundError:
    from main import app
    from main import get_current_user
    import main as main_module


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_generate_requires_auth(client):
    response = await client.post("/generate", json={"prompt": "A cinematic sunset"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_enforces_credit_exhaustion(client, monkeypatch):
    async def fake_get_or_create_user(user_id, email=None):
        return {"id": user_id, "tier": "free", "credits": 0}

    async def fake_get_user_credits(user_id):
        return 0

    app.dependency_overrides[get_current_user] = lambda: "user_test"
    monkeypatch.setattr(main_module, "get_or_create_user", fake_get_or_create_user)
    monkeypatch.setattr(main_module, "get_user_credits", fake_get_user_credits)

    try:
        response = await client.post("/generate", json={"prompt": "A cinematic sunset"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 402
    assert response.json() == {
        "error": "credits_exhausted",
        "message": "You've used all 5 free reels. Upgrade to Pro for unlimited.",
        "upgrade_url": "/pricing",
    }


@pytest.mark.asyncio
async def test_ideas_endpoint_returns_ideas(client, monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: "user_test"
    monkeypatch.setattr(
        main_module,
        "generate_content_ideas",
        lambda niche, platform, count: [f"idea {i}" for i in range(count)],
    )

    try:
        response = await client.post(
            "/ideas",
            json={"niche": "fitness", "platform": "instagram", "count": 3},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"ideas": ["idea 0", "idea 1", "idea 2"]}


@pytest.mark.asyncio
async def test_voice_token_requires_configuration(client, monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: "user_test"
    monkeypatch.delenv("LIVEKIT_API_KEY", raising=False)
    monkeypatch.delenv("LIVEKIT_API_SECRET", raising=False)
    monkeypatch.delenv("LIVEKIT_URL", raising=False)

    try:
        response = await client.post("/voice/token")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "LiveKit configuration is missing."

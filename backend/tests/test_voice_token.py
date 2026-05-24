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
    from backend.main import app, get_current_user
except ModuleNotFoundError:
    from main import app, get_current_user


def _override_auth(user_id="test_user"):
    app.dependency_overrides[get_current_user] = lambda: user_id


def _clear_auth():
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.mark.asyncio
async def test_voice_token_without_livekit_returns_503(client, monkeypatch):
    monkeypatch.delenv("LIVEKIT_URL", raising=False)
    monkeypatch.delenv("LIVEKIT_API_KEY", raising=False)
    monkeypatch.delenv("LIVEKIT_API_SECRET", raising=False)
    _override_auth()
    try:
        r = await client.post("/voice/token")
        assert r.status_code == 503
    finally:
        _clear_auth()


@pytest.mark.asyncio
async def test_voice_token_without_auth_returns_401(client):
    _clear_auth()
    r = await client.post("/voice/token")
    assert r.status_code == 401

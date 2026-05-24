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
    import backend.main as main_module
except ModuleNotFoundError:
    from main import app, get_current_user
    import main as main_module


def _override_auth(user_id="test_user"):
    app.dependency_overrides[get_current_user] = lambda: user_id


def _clear_auth():
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def client(monkeypatch):
    empty_kit = {"user_id": "test_user", "logo_url": None, "outro_clip_url": None}
    saved = {}

    async def fake_get_brand_kit(user_id):
        return {**empty_kit, **saved.get(user_id, {}), "user_id": user_id}

    async def fake_save_brand_kit(user_id, logo_url=None, outro_clip_url=None):
        current = saved.get(user_id, {})
        if logo_url is not None:
            current["logo_url"] = logo_url
        if outro_clip_url is not None:
            current["outro_clip_url"] = outro_clip_url
        saved[user_id] = current
        return {**empty_kit, **current, "user_id": user_id}

    monkeypatch.setattr(main_module, "get_brand_kit", fake_get_brand_kit)
    monkeypatch.setattr(main_module, "save_brand_kit", fake_save_brand_kit)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.mark.asyncio
async def test_get_brand_kit_empty(client):
    _override_auth()
    try:
        r = await client.get("/brand-kit")
        assert r.status_code == 200
        data = r.json()
        assert data["logo_url"] is None
        assert data["outro_clip_url"] is None
    finally:
        _clear_auth()


@pytest.mark.asyncio
async def test_put_brand_kit_saves_and_retrieves(client):
    _override_auth()
    try:
        r = await client.put(
            "/brand-kit",
            json={"logo_url": "https://example.com/logo.png", "outro_clip_url": None},
        )
        assert r.status_code == 200
        assert r.json().get("logo_url") == "https://example.com/logo.png"

        r2 = await client.get("/brand-kit")
        assert r2.status_code == 200
        assert r2.json().get("logo_url") == "https://example.com/logo.png"
    finally:
        _clear_auth()

import io
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
async def test_upload_valid_mp4(client):
    _override_auth()
    try:
        fake_video = io.BytesIO(b"\x00" * 1024)
        response = await client.post(
            "/upload/footage",
            files=[("files", ("test.mp4", fake_video, "video/mp4"))],
        )
        assert response.status_code == 200
        data = response.json()
        assert "assets" in data
        assert len(data["assets"]) == 1
        assert "asset_id" in data["assets"][0]
    finally:
        _clear_auth()


@pytest.mark.asyncio
async def test_upload_invalid_type_returns_400(client):
    _override_auth()
    try:
        fake_file = io.BytesIO(b"not a video")
        response = await client.post(
            "/upload/footage",
            files=[("files", ("photo.jpg", fake_file, "image/jpeg"))],
        )
        assert response.status_code == 400
        assert "Unsupported" in response.json().get("detail", "")
    finally:
        _clear_auth()


@pytest.mark.asyncio
async def test_upload_requires_auth(client):
    _clear_auth()
    fake_video = io.BytesIO(b"\x00" * 1024)
    response = await client.post(
        "/upload/footage",
        files=[("files", ("test.mp4", fake_video, "video/mp4"))],
    )
    assert response.status_code == 401

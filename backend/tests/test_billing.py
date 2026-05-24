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
    import routers.billing as billing_module
except ModuleNotFoundError:
    from main import app
    import routers.billing as billing_module


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_billing_webhook_adds_credits(client, monkeypatch):
    added = {}

    class FakeStripe:
        class error:
            class SignatureVerificationError(Exception):
                pass

        class Webhook:
            @staticmethod
            def construct_event(payload, signature, webhook_secret):
                return {
                    "type": "checkout.session.completed",
                    "data": {
                        "object": {
                            "metadata": {"user_id": "user_123"},
                        }
                    },
                }

    async def fake_add_credits(user_id, amount):
        added["user_id"] = user_id
        added["amount"] = amount
        return 15

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_demo")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_demo")
    monkeypatch.setattr(billing_module, "get_stripe_module", lambda: FakeStripe)
    monkeypatch.setattr(billing_module, "add_credits", fake_add_credits)

    response = await client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "valid"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}
    assert added == {"user_id": "user_123", "amount": 10}


@pytest.mark.asyncio
async def test_billing_webhook_rejects_invalid_signature(client, monkeypatch):
    class FakeStripe:
        class error:
            class SignatureVerificationError(Exception):
                pass

        class Webhook:
            @staticmethod
            def construct_event(payload, signature, webhook_secret):
                raise FakeStripe.error.SignatureVerificationError("invalid")

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_demo")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_demo")
    monkeypatch.setattr(billing_module, "get_stripe_module", lambda: FakeStripe)

    response = await client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "invalid"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid signature"}

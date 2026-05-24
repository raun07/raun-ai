import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request

from database.crud import add_credits
from middleware.auth import get_current_user


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

try:
    import stripe as stripe_module
except Exception:
    stripe_module = None


def _frontend_base_url():
    return os.getenv("FRONTEND_APP_URL", "http://localhost:5173").rstrip("/")


def get_stripe_module():
    if stripe_module is None:
        logger.warning("[Billing] Stripe SDK is not installed")
        raise HTTPException(status_code=503, detail="Billing SDK is not installed")
    return stripe_module


def _run_async_db_task(coro, operation_name, default=None):
    import asyncio

    try:
        return asyncio.run(coro)
    except Exception as exc:
        logger.exception("[Billing] %s failed: %s", operation_name, exc)
        return default


async def _run_async_db_task_async(coro, operation_name, default=None):
    try:
        return await coro
    except Exception as exc:
        logger.exception("[Billing] %s failed: %s", operation_name, exc)
        return default


@router.post("/create-checkout")
async def create_checkout(user_id: str = Depends(get_current_user)):
    stripe = get_stripe_module()
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        logger.warning("[Billing] STRIPE_SECRET_KEY is not configured")
        raise HTTPException(status_code=503, detail="Billing is not configured")

    stripe.api_key = secret_key
    frontend_url = _frontend_base_url()

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "10 Reels"},
                        "unit_amount": 500,
                    },
                    "quantity": 1,
                }
            ],
            metadata={"user_id": user_id},
            success_url=f"{frontend_url}/dashboard?payment=success",
            cancel_url=f"{frontend_url}/pricing",
        )
        logger.info("[Billing] Created Stripe checkout session for user %s", user_id)
        return {"url": session.url}
    except Exception as exc:
        logger.exception("[Billing] Failed to create checkout for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="Unable to create checkout session")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    stripe = get_stripe_module()
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret_key or not webhook_secret:
        logger.warning("[Billing] Stripe webhook called without configured secrets")
        raise HTTPException(status_code=503, detail="Billing is not configured")

    stripe.api_key = secret_key
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, signature, webhook_secret)
    except stripe.error.SignatureVerificationError:
        logger.warning("[Billing] Invalid Stripe webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except ValueError:
        logger.warning("[Billing] Invalid Stripe webhook payload")
        raise HTTPException(status_code=400, detail="Invalid payload")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        if user_id:
            credits = await _run_async_db_task_async(
                add_credits(user_id, 10),
                f"add_credits({user_id})",
                default=10,
            )
            logger.info(
                "[Billing] Added credits for user %s after Stripe checkout. New credits: %s",
                user_id,
                credits,
            )
        else:
            logger.warning("[Billing] Stripe checkout completed without user_id metadata")

    return {"received": True}

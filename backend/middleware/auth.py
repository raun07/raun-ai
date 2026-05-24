import logging
import os

from fastapi import Header, HTTPException, Request, status
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions, AuthStatus


# Clerk auth is isolated here so generation logic can stay focused on the reel pipeline.
def get_current_user(request: Request, authorization: str | None = Header(default=None)) -> str:
    try:
        if not authorization or not authorization.startswith("Bearer "):
            logging.warning("[Auth] Missing or invalid Authorization header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization token",
            )

        clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
        if not clerk_secret_key:
            logging.error("[Auth] CLERK_SECRET_KEY is not configured")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication is not configured",
            )

        sdk = Clerk(bearer_auth=clerk_secret_key)
        request_state = sdk.authenticate_request(
            request,
            AuthenticateRequestOptions(
                accepts_token=["session_token"],
                secret_key=clerk_secret_key,
            ),
        )

        if request_state.status != AuthStatus.SIGNED_IN or not request_state.payload:
            logging.warning(
                f"[Auth] Clerk authentication failed: {getattr(request_state.reason, 'value', request_state.reason)}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token",
            )

        user_id = request_state.payload.get("sub")
        if not user_id:
            logging.warning("[Auth] Authenticated token missing user_id claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user could not be resolved",
            )

        logging.info(f"[Auth] Authenticated Clerk user: {user_id}")
        return user_id

    except HTTPException:
        raise
    except Exception as exc:
        logging.error(f"[Auth] Unexpected Clerk authentication error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

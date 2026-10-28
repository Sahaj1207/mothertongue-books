"""Who is calling: verifies Supabase Auth access tokens with the Auth server."""

import time
from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException

from app.config import settings

# Verified tokens are remembered briefly so the progress screen's 1-second polling
# doesn't call the Auth server on every request.
_CACHE_SECONDS = 60
_cache: dict[str, tuple[float, "User"]] = {}


@dataclass(frozen=True)
class User:
    id: str
    email: str | None


async def verify_token(token: str) -> User | None:
    cached = _cache.get(token)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_publishable_key, "Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        return None
    body = r.json()
    user = User(id=body["id"], email=body.get("email"))
    _cache[token] = (time.monotonic() + _CACHE_SECONDS, user)
    return user


def _bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip() or None
    return None


async def optional_user(authorization: str | None = Header(default=None)) -> User | None:
    token = _bearer(authorization)
    return await verify_token(token) if token else None


async def require_user(authorization: str | None = Header(default=None)) -> User:
    user = await optional_user(authorization)
    if user is None:
        raise HTTPException(401, "Sign in to do this.")
    return user

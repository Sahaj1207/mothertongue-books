"""Page illustrations: prompts built from the plan, drawn by FLUX.1 [schnell], stored in Supabase.

FLUX runs on Cloudflare Workers AI (free plan, no card) or, if a card is on file, on a Modal GPU.
"""

import asyncio
import base64
import hashlib
import time
from typing import Protocol

import httpx

from app.agents.schemas import PagePlan, StoryPlan
from app.config import settings
from app.usage import record_cost

STYLE = (
    "Children's picture book illustration, soft gouache and watercolour texture, warm natural light, "
    "gentle rounded shapes, friendly expressions, uncluttered background, Indian setting, "
    "no text, no letters, no words."
)

# Modal L40S list price plus a little CPU and memory, per second of drawing.
GPU_USD_PER_SECOND = 0.00060


# Cloudflare bills FLUX.1 schnell in "neurons": 4.8 per 512x512 tile plus 9.6 per step, at $0.011 per
# 1,000 above the free 10,000 a day. A 1024x1024 picture in 4 steps is about 58 neurons. The free plan
# can't be charged, so this cost is only recorded to show usage.
CLOUDFLARE_USD_PER_PICTURE = (4 * 4.8 + 4 * 9.6) * 0.011 / 1000


class ImageMaker(Protocol):
    content_type: str

    async def draw(self, prompt: str, seed: int) -> bytes: ...


class CloudflareImageMaker:
    """FLUX.1 [schnell] on Cloudflare Workers AI. It takes no seed, so the fixed character looks carry consistency."""

    content_type = "image/jpeg"

    def __init__(self, account_id: str, api_token: str) -> None:
        self.http = httpx.AsyncClient(
            base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run",
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=120,
        )

    async def draw(self, prompt: str, seed: int) -> bytes:
        r = await self.http.post(
            "/@cf/black-forest-labs/flux-1-schnell", json={"prompt": prompt[:2048], "steps": 4}
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success") or "image" not in body.get("result", {}):
            raise RuntimeError(f"Cloudflare returned no picture: {body.get('errors')}")
        record_cost("cloudflare", "flux-1-schnell", "illustrator", CLOUDFLARE_USD_PER_PICTURE)
        return base64.b64decode(body["result"]["image"])


class ModalImageMaker:
    """Calls the deployed illustrator (illustrator_app.py) and records the GPU time it used."""

    content_type = "image/webp"

    def __init__(self, app_name: str) -> None:
        import modal

        self._draw = modal.Cls.from_name(app_name, "Illustrator")().draw

    async def draw(self, prompt: str, seed: int) -> bytes:
        start = time.perf_counter()
        data = await self._draw.remote.aio(prompt, seed)
        record_cost(
            "modal", "flux.1-schnell", "illustrator", (time.perf_counter() - start) * GPU_USD_PER_SECOND
        )
        return data


def picture_prompt(plan: StoryPlan, page: PagePlan) -> str:
    """Style, then the fixed look of every character named in this scene, then the scene itself."""
    looks = [
        f"{c.name}: {c.look}" for c in plan.characters if c.look and c.name.lower() in page.scene.lower()
    ]
    parts = [STYLE, *looks, page.scene]
    return " ".join(parts)


def book_seed(book_id: str) -> int:
    """One seed per book, so every page is drawn in the same hand."""
    return int(hashlib.sha256(book_id.encode()).hexdigest()[:8], 16)


async def draw_pages(maker: ImageMaker, plan: StoryPlan, book_id: str, on_page_done) -> dict[int, bytes]:
    """Draws every page, a few at a time. Pages that fail are left out rather than failing the book."""
    limit = asyncio.Semaphore(settings.illustration_concurrency)
    seed = book_seed(book_id)
    drawn: dict[int, bytes] = {}

    async def one(page: PagePlan) -> None:
        async with limit:
            drawn[page.number] = await maker.draw(picture_prompt(plan, page), seed)
            await on_page_done(len(drawn), len(plan.pages))

    results = await asyncio.gather(*(one(p) for p in plan.pages), return_exceptions=True)
    for page, result in zip(plan.pages, results, strict=True):
        if isinstance(result, Exception):
            drawn.pop(page.number, None)
    return drawn

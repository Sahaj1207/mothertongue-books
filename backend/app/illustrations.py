"""Page illustrations: prompts built from the plan, drawn by FLUX.1 [schnell] on Modal, stored in Supabase."""

import asyncio
import hashlib
import time
from typing import Protocol

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


class ImageMaker(Protocol):
    async def draw(self, prompt: str, seed: int) -> bytes: ...


class ModalImageMaker:
    """Calls the deployed illustrator (illustrator_app.py) and records the GPU time it used."""

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

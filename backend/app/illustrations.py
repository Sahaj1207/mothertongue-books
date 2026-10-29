"""Page illustrations: prompts built from the plan, drawn by FLUX.1 [schnell], stored in Supabase.

FLUX runs on Cloudflare Workers AI (free plan, no card) or, if a card is on file, on a Modal GPU.
"""

import asyncio
import base64
import hashlib
import io
import logging
import re
import time
from typing import NamedTuple, Protocol

import httpx

from app.agents.schemas import PagePlan, PictureCheck, StoryPlan
from app.config import settings
from app.usage import record_cost

log = logging.getLogger("mothertongue")

STYLE = (
    "Children's picture book illustration, soft gouache and watercolour texture, warm natural light, "
    "gentle rounded shapes, friendly expressions, uncluttered background, Indian setting, "
    "every character shown whole and fully inside the frame, "
    # Name no objects here: FLUX draws whatever the style mentions ("buses" put buses in forests).
    "no writing anywhere: no text, letters, words, labels or signature."
)

# Modal L40S list price plus a little CPU and memory, per second of drawing.
GPU_USD_PER_SECOND = 0.00060


# Cloudflare bills FLUX.1 schnell in "neurons" at $0.011 per 1,000 above the free 10,000 a day. Measured:
# a 1024x1024 picture in 4 steps uses about 137, so the free plan draws about 70 pictures a day. It can't
# be charged, so this cost is only recorded to show usage.
CLOUDFLARE_NEURONS_PER_PICTURE = 137
CLOUDFLARE_USD_PER_PICTURE = CLOUDFLARE_NEURONS_PER_PICTURE * 0.011 / 1000


class PicturesUsedUp(Exception):
    """The illustrator's free daily allowance is spent; it comes back at 00:00 UTC."""


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
        if r.status_code == 429 and "4006" in r.text:
            raise PicturesUsedUp()
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


def scene_looks(plan: StoryPlan, page: PagePlan) -> list[str]:
    """The fixed look of every character named in this page's scene."""
    return [f"{c.name}: {c.look}" for c in plan.characters if c.look and c.name.lower() in page.scene.lower()]


def picture_prompt(plan: StoryPlan, page: PagePlan, fixes: list[str] | None = None) -> str:
    """Style, the scene with each character described instead of named, and any fixes from the checker.

    FLUX tends to write any name it sees into the picture, so names never reach the prompt.
    """
    in_scene = [c for c in plan.characters if c.look and c.name.lower() in page.scene.lower()]
    parts = [STYLE, without_names(plan, page.scene)]
    if in_scene:
        parts.append("Only these people appear, each drawn whole, with no extra people.")
    if fixes:
        parts += ["Draw every person whole, with the head joined to the body. Avoid:"]
        parts += [without_names(plan, fix) for fix in fixes]
    return " ".join(parts)[:2048]


def without_names(plan: StoryPlan, text: str) -> str:
    """Drops quoted words, then replaces character names with their looks, so FLUX has no text to copy."""
    text = re.sub(r"[\"“”][^\"“”]{0,60}[\"“”]", "", text)
    text = re.sub(r"(?<![A-Za-z])'[^']{1,60}'(?![A-Za-z])", "", text)
    for c in plan.characters:
        if c.look:
            look = c.look.strip().rstrip(".")
            text = re.sub(
                rf"\b{re.escape(c.name)}('s)?\b",
                lambda m, look=look: f"({look}){m.group(1) or ''}",
                text,
                flags=re.IGNORECASE,
            )
    return text


def book_seed(book_id: str) -> int:
    """One seed per book, so every page is drawn in the same hand."""
    return int(hashlib.sha256(book_id.encode()).hexdigest()[:8], 16)


class Checker(Protocol):
    async def __call__(self, data: bytes, page: PagePlan) -> PictureCheck: ...


class Drawing(NamedTuple):
    data: bytes
    # Problems the checker still saw after the last redraw, for the adult reviewer.
    unresolved: list[str]


async def draw_pages(
    maker: ImageMaker,
    plan: StoryPlan,
    book_id: str,
    on_progress,
    check: Checker | None = None,
    only: set[int] | None = None,
    seed_offset: int = 0,
    hints: list[str] | None = None,
) -> dict[int, Drawing]:
    """Draws every page (or just `only`) a few at a time; each picture is checked and redrawn if flawed.

    `hints` are the adult's own notes for a redraw, followed like the checker's. Pages that can't be
    drawn at all are left out rather than failing the book.
    """
    limit = asyncio.Semaphore(settings.illustration_concurrency)
    seed = book_seed(book_id) + seed_offset
    pages = [p for p in plan.pages if only is None or p.number in only]
    drawn: dict[int, Drawing] = {}

    async def one(page: PagePlan) -> None:
        async with limit:
            fixes: list[str] = list(hints or [])
            for attempt in range(settings.max_picture_redraws + 1):
                if attempt:
                    await on_progress(len(drawn), len(pages), redrawing=page.number)
                data = await maker.draw(picture_prompt(plan, page, fixes), seed + attempt)
                review = await _safe_check(check, data, page)
                if review is None or review.usable:
                    drawn[page.number] = Drawing(data, [])
                    break
                fixes = [*(hints or []), *review.problems]
            else:
                drawn[page.number] = Drawing(data, review.problems)
            await on_progress(len(drawn), len(pages))

    results = await asyncio.gather(*(one(p) for p in pages), return_exceptions=True)
    if not drawn and any(isinstance(r, PicturesUsedUp) for r in results):
        raise PicturesUsedUp()
    for page, result in zip(pages, results, strict=True):
        if isinstance(result, Exception):
            log.warning("Page %s picture failed: %s", page.number, result)
            drawn.pop(page.number, None)
    return drawn


async def _safe_check(check: Checker | None, data: bytes, page: PagePlan) -> PictureCheck | None:
    """A checker outage shouldn't lose a picture; the adult still reviews every page before publishing."""
    if check is None:
        return None
    try:
        return await check(data, page)
    except Exception:
        log.exception("Picture check failed for page %s", page.number)
        return None


def checker_copy(data: bytes, size: int = 512) -> tuple[bytes, str]:
    """A small JPEG for the picture checker: flaws are still obvious, and it costs far fewer tokens."""
    from PIL import Image

    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        img.thumbnail((size, size))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=80)
    return out.getvalue(), "image/jpeg"


def web_copy(data: bytes, size: int = 1024) -> bytes:
    """WebP for the reader: about a quarter the size of FLUX's JPEG, so pages load fast on phones."""
    from PIL import Image

    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        img.thumbnail((size, size))
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=80, method=6)
    return out.getvalue()

"""Draws one test picture with the configured illustrator and saves it, with timing.

Run from backend/:  uv run python -m scripts.try_illustration out.jpg
"""

import asyncio
import sys
import time

from app.agents.schemas import Character, PagePlan, StoryPlan
from app.illustrations import picture_prompt
from app.main import get_image_maker
from app.store import store
from app.usage import UsageMeter, current_meter

PLAN = StoryPlan(
    title_en="Up, Up Goes My Kite",
    setting="A village rooftop on Sankranti morning",
    lesson="Joy is better shared",
    characters=[
        Character(
            name="Chinni",
            description="A cheerful six-year-old girl",
            look="six-year-old Indian girl with two braids, yellow pavadai skirt and red bangles",
        ),
        Character(
            name="Tata",
            description="Chinni's grandfather",
            look="kind elderly Indian man with white hair, white moustache and a cream kurta",
        ),
    ],
    pages=[
        PagePlan(
            number=1,
            event="Chinni flies her red kite",
            scene="Chinni flies a red kite on the rooftop while Tata claps beside her, blue sky with other kites.",
        )
    ],
)


async def draw() -> bytes:
    maker = get_image_maker()
    if maker is None:
        sys.exit(
            "No illustrator: set USE_MOCK_AI=false and the illustrator keys, or check ILLUSTRATIONS_ENABLED."
        )
    meter = UsageMeter()
    current_meter.set(meter)
    prompt = picture_prompt(PLAN, PLAN.pages[0])
    start = time.perf_counter()
    try:
        data = await maker.draw(prompt, seed=7)
    finally:
        await store.save_usage(None, meter.entries)
    print(
        f"{type(maker).__name__}: {time.perf_counter() - start:.1f}s, {len(data) // 1024} KB, ${meter.cost_usd:.5f}"
    )
    return data


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "illustration.jpg"
    with open(out, "wb") as f:
        f.write(asyncio.run(draw()))
    print(f"saved {out}")

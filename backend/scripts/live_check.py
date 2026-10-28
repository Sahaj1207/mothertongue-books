"""Live check of each model provider that has a key in .env. Spends a few cents at most.

Run from backend/:  uv run python -m scripts.live_check
"""

import asyncio
import time

from app.agents import agents
from app.agents.client import MetaModelClient, OpenWeightClient
from app.agents.schemas import BookRequest, StoryDraft, StoryPage
from app.config import settings
from app.store import store
from app.usage import UsageMeter, current_meter

SAMPLE = StoryDraft(
    language="te",
    title="మామిడి చెట్టు",
    pages=[
        StoryPage(number=1, text="అను మామిడి చెట్టు దగ్గరకు వెళ్ళింది."),
        StoryPage(number=2, text="ఆమె తన స్నేహితుడితో మామిడి పండు పంచుకుంది."),
    ],
)


async def timed(label: str, coro):
    start = time.perf_counter()
    try:
        result = await coro
    except Exception as exc:  # noqa: BLE001 - report any provider failure
        print(f"FAIL  {label}: {type(exc).__name__}: {exc}")
        return None
    print(f"OK    {label} ({time.perf_counter() - start:.1f}s): {result.model_dump_json()[:300]}")
    return result


async def main() -> None:
    # Count these calls too, so the per-provider budget caps include test spending.
    meter = UsageMeter()
    current_meter.set(meter)
    try:
        await run_checks()
    finally:
        await store.save_usage(None, meter.entries)
        print(f"Recorded ${meter.cost_usd:.4f} of usage")


async def run_checks() -> None:
    if settings.baseten_api_key:
        open_model = OpenWeightClient(
            settings.baseten_api_key, settings.baseten_base_url, settings.open_weight_model
        )
        await timed("Muse Spark Open safety review", agents.review_safety(open_model, SAMPLE))
    else:
        print("SKIP  Muse Spark Open: BASETEN_API_KEY not set")

    if settings.model_api_key:
        spark = MetaModelClient(settings.model_api_key, settings.meta_base_url, settings.story_model)
        request = BookRequest(language="te", level=1, topic="Sharing mangoes with a new friend")
        await timed("Muse Spark topic check", agents.check_topic(spark, request))
    else:
        print("SKIP  Muse Spark: MODEL_API_KEY not set")


if __name__ == "__main__":
    asyncio.run(main())

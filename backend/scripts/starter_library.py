"""Makes the starter library from starter_library.json, within the illustrator's free daily pictures.

  uv run python -m scripts.starter_library outlines   # draft folk-tale steps that are still empty
  uv run python -m scripts.starter_library make       # make the next books while pictures last

Made books are drafts owned by STARTER_OWNER, reviewed and published from the website like any other.
Each made book's id is written back into the JSON, so running `make` again continues where it stopped.
"""

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from app.agents import agents
from app.agents.client import get_client
from app.agents.schemas import BookRequest
from app.illustrations import CLOUDFLARE_NEURONS_PER_PICTURE
from app.main import get_image_maker
from app.models import Job
from app.pipeline import run_pipeline
from app.segmentation import get_segmenter
from app.store import store
from app.usage import UsageMeter, current_meter

PLAN = Path(__file__).with_name("starter_library.json")
STARTER_OWNER = "12e8685b-5eb6-43a6-a7ab-c3a85c221be7"
FREE_NEURONS_A_DAY = 10_000
# A book is about 8 pages plus a redraw or three; don't start one that can't finish its pictures.
PICTURES_PER_BOOK = 12


def load() -> list[dict]:
    return json.loads(PLAN.read_text(encoding="utf-8"))


def save(books: list[dict]) -> None:
    PLAN.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


async def outlines() -> None:
    books = load()
    meter = UsageMeter()
    current_meter.set(meter)
    for book in books:
        if book.get("skip") or book.get("kind") != "folk-tale" or book.get("outline"):
            continue
        result = await agents.outline_folk_tale(get_client(), book["topic"], book["language"])
        if not result.known:
            book["check"] = f"Muse Spark didn't know this tale: {result.notes} Write the steps yourself."
            continue
        book["outline"] = "\n".join(result.beats)
        book["source"] = book.get("source") or result.source
        book["check"] = f"Made gentle: {result.notes}"
        print(f"{book['topic']}: {len(result.beats)} steps")
    save(books)
    print(f"Cost ${meter.cost_usd:.4f}")


async def pictures_left_today() -> int:
    from app.store import SupabaseStore

    if not isinstance(store, SupabaseStore):
        return 10**6
    start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = await store._select(
        "model_usage",
        {"select": "id", "agent": "eq.illustrator", "created_at": f"gte.{start.isoformat()}"},
    )
    return (FREE_NEURONS_A_DAY - len(rows) * CLOUDFLARE_NEURONS_PER_PICTURE) // CLOUDFLARE_NEURONS_PER_PICTURE


async def make() -> None:
    books = load()
    maker, segmenter = get_image_maker(), get_segmenter()
    if maker is None:
        sys.exit("No illustrator configured; set USE_MOCK_AI=false and the Cloudflare keys.")
    for book in books:
        if book.get("skip") or book.get("book_id"):
            continue
        if book.get("kind") == "folk-tale" and not book.get("outline"):
            print(f"Skipping {book['topic']}: its steps aren't written yet.")
            continue
        left = await pictures_left_today()
        if left < PICTURES_PER_BOOK:
            print(f"About {left} pictures left today; stopping. Run again after 5:30 AM India time.")
            break
        fields = {k: book.get(k) for k in ("language", "pair_language", "level", "kind", "topic", "source", "outline")}
        job = Job(request=BookRequest(**{k: v for k, v in fields.items() if v is not None}), owner_id=STARTER_OWNER)
        print(f"Making {book['topic']} ({book['language']})…", flush=True)
        try:
            await run_pipeline(get_client(), job, store, maker, segmenter)
        except Exception as exc:  # noqa: BLE001 -- one book failing shouldn't stop the others
            print(f"  failed: {exc!r}"[:300])
            book["message"] = repr(exc)[:300]
            continue
        book["book_id"], book["status"], book["cost_usd"] = job.book_id, job.status, job.cost_usd
        if job.message:
            book["message"] = job.message
        save(books)
        print(f"  {job.status}, ${job.cost_usd:.3f}, book {job.book_id}")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command not in ("outlines", "make"):
        sys.exit(__doc__)
    asyncio.run(outlines() if command == "outlines" else make())

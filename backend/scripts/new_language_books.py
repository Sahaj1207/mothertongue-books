"""Writes one book in each new language, text only, so native readers can check it before it gets pictures.

Run from backend/:  uv run python -m scripts.new_language_books
Pictures come later with scripts.redraw_pictures <book-id>. Each book's id is recorded in starter_library.json.
"""

import asyncio
import json
from pathlib import Path

from app.agents.client import get_client
from app.agents.schemas import BookRequest
from app.models import Job
from app.pipeline import run_pipeline
from app.store import store
from app.usage import UsageMeter, current_meter
from scripts.starter_library import PLAN, STARTER_OWNER

BOOKS = [
    {"language": "sw", "level": 2, "kind": "original", "topic": "Helping Bibi at the market in Mombasa"},
    {"language": "ne", "level": 2, "kind": "original", "topic": "Flying kites at Dashain with Hajurba"},
    {"language": "zu", "level": 1, "kind": "original", "topic": "Helping Gogo in her vegetable garden"},
    {"language": "ht", "level": 2, "kind": "original", "topic": "Flying kites at Easter with Grann"},
    {"language": "eu", "level": 2, "kind": "original", "topic": "Waiting for Olentzero on Christmas Eve"},
]

REVIEW_DIR = Path(__file__).resolve().parents[2] / "review"


async def main() -> None:
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    done = {(b.get("language"), b.get("topic")) for b in plan if b.get("book_id")}
    meter = UsageMeter()
    current_meter.set(meter)
    REVIEW_DIR.mkdir(exist_ok=True)
    for entry in BOOKS:
        if (entry["language"], entry["topic"]) in done:
            continue
        job = Job(request=BookRequest(**entry), owner_id=STARTER_OWNER)
        print(f"Writing {entry['topic']} ({entry['language']})…", flush=True)
        # No illustrator: the text first, for a native reader to check.
        await run_pipeline(get_client(), job, store, None, None)
        print(f"  {job.status} {job.book_id or ''} {job.message or ''}")
        plan.append(entry | {"book_id": job.book_id, "status": job.status, "pictures": "later"})
        PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if job.book_id:
            write_review_file(await store.get_book(job.book_id))
    print(f"Cost ${meter.cost_usd:.4f}")


def write_review_file(book) -> None:
    """A plain text a native reader can check without the app: each page, with the English plan beneath."""
    draft = book.drafts[0]
    events = {p.number: p.event for p in book.plan.pages}
    ages = ["3-5", "5-7", "7-9"][book.request.level - 1]
    lines = [
        f"{draft.title}",
        f"({book.plan.title_en}, a children's picture book for ages {ages})",
        "",
        "Please check: does each page sound natural to a parent reading aloud? Note any word or sentence",
        "that is wrong, unnatural or too hard for the age, and what it should be.",
        "",
    ]
    for page in draft.pages:
        lines += [f"Page {page.number}", page.text, f"  (meaning: {events.get(page.number, '')})", ""]
    for note in book.review_notes:
        lines.append(f"Our checker's note: {note}")
    path = REVIEW_DIR / f"{book.request.language}-{book.plan.title_en.lower().replace(' ', '-')[:40]}.txt"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  review file: {path.name}")


if __name__ == "__main__":
    asyncio.run(main())

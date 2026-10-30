"""The launch library's folk tales in Telugu, Kannada and Marathi: one plan and one set of pictures per tale,
each language written natively from the plan (as in two-language books), never translated.

  uv run python -m scripts.folk_versions make      # write every missing version (and the two new tales)
  uv run python -m scripts.folk_versions pictures  # once a tale's first book has pictures, share them

Progress is kept in folk_versions.json, so either command can be run again safely.
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx

from app.agents import agents
from app.agents.client import get_client
from app.agents.schemas import BookRequest
from app.models import Book, Job
from app.pipeline import Run, StoryRejected, build_steps, run_pipeline
from app.segmentation import get_segmenter
from app.store import store
from app.usage import UsageMeter, current_meter
from scripts.new_language_books import write_review_file
from scripts.starter_library import STARTER_OWNER

STATE = Path(__file__).with_name("folk_versions.json")
LANGS = ["te", "kn", "mr"]

# Each tale's first book: an existing book id, or a new tale written first in the given language.
TALES = {
    "Punyakoti, the truthful cow": {"source": "aa8018e9-7e10-4377-89e8-316c5bb51967"},
    "The thirsty crow": {"source": "f7477965-34b6-46ca-ab57-edaa78538d9e"},
    "Chiu and Kau, the sparrow and the crow": {"source": "ff14df89-44af-4217-ad67-cd85f0a711ad"},
    "The lion and the clever rabbit": {"first_language": "kn", "level": 2},
    "The monkey and the crocodile": {"first_language": "mr", "level": 2},
}


class _NoJobs:
    """Progress for these scripted books goes to memory, not to the jobs table."""

    def __getattr__(self, name):
        return getattr(store, name)

    async def save_job(self, job) -> None:
        pass


def load() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save(state: dict) -> None:
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def first_book(tale: str, spec: dict) -> Book | None:
    """A new tale: the traditional outline, then the first language's book, text only (pictures come later)."""
    from scripts.starter_library import PLAN

    starter = json.loads(PLAN.read_text(encoding="utf-8"))
    outline = next((b for b in starter if b.get("topic") == tale and b.get("outline")), None)
    if outline:
        steps, source = outline["outline"], outline.get("source")
    else:
        result = await agents.outline_folk_tale(get_client(), tale, spec["first_language"])
        if not result.known:
            print(f"  outline helper doesn't know {tale}: {result.notes}")
            return None
        steps, source = "\n".join(result.beats), result.source
    request = BookRequest(
        language=spec["first_language"],
        level=spec["level"],
        kind="folk-tale",
        topic=tale,
        source=source,
        outline=steps,
    )
    job = Job(request=request, owner_id=STARTER_OWNER)
    await run_pipeline(get_client(), job, store, None, None)
    print(f"  {spec['first_language']}: {job.status} {job.message or ''}")
    return await store.get_book(job.book_id) if job.book_id else None


async def version(source: Book, language: str) -> Book | None:
    """The same plan and pictures, written natively in another language and checked like any book."""
    request = source.request.model_copy(update={"language": language, "pair_language": None})
    job = Job(request=request, owner_id=STARTER_OWNER)
    segmenter = get_segmenter() if source.images else None
    job.steps = build_steps(job, illustrate=bool(source.images), tap_words=segmenter is not None)
    run = Run(get_client(), job, _NoJobs())
    try:
        draft = await run.write_and_review(source.plan, language)
    except StoryRejected as exc:
        print(f"  {language}: rejected: {exc}")
        return None
    book = Book(
        request=request,
        plan=source.plan,
        drafts=[draft],
        review_notes=run.notes + [n for n in source.review_notes if " picture: " in n],
        images=dict(source.images),
        owner_id=STARTER_OWNER,
    )
    await store.save_book(book)
    if segmenter is not None:
        await add_words(run, segmenter, book)
    print(f"  {language}: done ({len(book.images)} pictures, {sum(map(len, book.words.values()))} words)")
    return book


async def add_words(run: Run, segmenter, book: Book) -> None:
    async with httpx.AsyncClient(timeout=60) as http:
        drawn = {n: (await http.get(url)).content for n, url in book.images.items()}
    await run.find_tap_words(segmenter, book, drawn)


async def make() -> None:
    state = load()
    meter = UsageMeter()
    current_meter.set(meter)
    for tale, spec in TALES.items():
        entry = state.setdefault(tale, {})
        print(tale)
        if "source" not in entry:
            if spec.get("source"):
                entry["source"] = spec["source"]
            else:
                book = await first_book(tale, spec)
                if book is None:
                    continue
                entry["source"] = book.id
            save(state)
        source = await store.get_book(entry["source"])
        entry.setdefault("versions", {source.request.language: source.id})
        for language in LANGS:
            if language in entry["versions"]:
                continue
            book = await version(source, language)
            if book:
                entry["versions"][language] = book.id
                entry["needs_pictures"] = not book.images
                save(state)
                write_review_file(book)
        await store.save_usage(None, meter.entries)
        meter.entries.clear()
    print(json.dumps({t: e.get("versions") for t, e in state.items()}, ensure_ascii=False, indent=1))


async def pictures() -> None:
    """After a tale's first book is drawn (scripts.redraw_pictures), give its versions the same pictures."""
    state = load()
    meter = UsageMeter()
    current_meter.set(meter)
    segmenter = get_segmenter()
    for tale, entry in state.items():
        source = await store.get_book(entry.get("source", ""))
        if not source or not source.images:
            continue
        for language, book_id in entry.get("versions", {}).items():
            book = await store.get_book(book_id)
            if book is None or book.id == source.id or book.images == source.images:
                continue
            book.images = dict(source.images)
            await store.save_book(book)
            job = Job(request=book.request, owner_id=STARTER_OWNER)
            job.steps = build_steps(job, illustrate=True, tap_words=True)
            if segmenter is not None:
                await add_words(Run(get_client(), job, _NoJobs()), segmenter, book)
            print(
                f"{tale} ({language}): {len(book.images)} pictures, {sum(map(len, book.words.values()))} words"
            )
        entry["needs_pictures"] = False
        save(state)
    await store.save_usage(None, meter.entries)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command not in ("make", "pictures"):
        sys.exit(__doc__)
    asyncio.run(make() if command == "make" else pictures())

import asyncio
import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agents import agents
from app.agents.client import get_client
from app.agents.schemas import BookRequest, FolkOutline, OutlineRequest, StoryPage
from app.auth import User, optional_user, require_user
from app.config import settings
from app.illustrations import CloudflareImageMaker, ImageMaker, ModalImageMaker
from app.models import Book, Correction, Job
from app.pipeline import redraw_page, run_pipeline
from app.segmentation import apply_corrections, get_segmenter
from app.share import router as share_router
from app.store import store
from app.usage import UsageMeter, current_meter

log = logging.getLogger("mothertongue")

SignedIn = Annotated[User, Depends(require_user)]
MaybeSignedIn = Annotated[User | None, Depends(optional_user)]

app = FastAPI(title="MotherTongue Books API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)

app.include_router(share_router)

_tasks: set[asyncio.Task] = set()


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "mock_ai": settings.use_mock_ai, "storage": type(store).__name__}


@app.post("/api/books", status_code=202)
async def create_book(request: BookRequest, user: SignedIn) -> Job:
    if not settings.use_mock_ai:
        await check_budget()
    job = Job(request=request, owner_id=user.id)
    await store.save_job(job)
    task = asyncio.create_task(run_pipeline(get_client(), job, store, get_image_maker(), get_segmenter()))
    _tasks.add(task)
    task.add_done_callback(_finish_task)
    return job


@app.post("/api/folk-outline")
async def folk_outline(request: OutlineRequest, user: SignedIn) -> FolkOutline:
    """Draft the plot of a traditional tale for the adult to check and edit before making the book."""
    if not settings.use_mock_ai:
        await check_budget()
    meter = UsageMeter()
    token = current_meter.set(meter)
    try:
        return await agents.outline_folk_tale(get_client(), request.tale, request.language)
    finally:
        current_meter.reset(token)
        await store.save_usage(None, meter.entries)


def get_image_maker() -> ImageMaker | None:
    if settings.use_mock_ai or not settings.illustrations_enabled:
        return None
    if settings.illustrator == "modal":
        return ModalImageMaker(settings.illustrator_app)
    if settings.cloudflare_account_id and settings.cloudflare_api_token:
        return CloudflareImageMaker(settings.cloudflare_account_id, settings.cloudflare_api_token)
    log.warning("Illustrations are on but Cloudflare keys are missing; books will have no pictures.")
    return None


def providers_in_use() -> list[str]:
    # Cloudflare's free plan can't be charged, so only the Modal GPU needs a budget check.
    providers = ["modal"] if settings.illustrations_enabled and settings.illustrator == "modal" else []
    if settings.story_provider == "open-weight":
        return [*providers, "baseten"]
    return [*providers, "meta", "baseten"] if settings.baseten_api_key else [*providers, "meta"]


async def check_budget() -> None:
    if await store.spent_today_usd() >= settings.daily_budget_usd:
        raise HTTPException(429, "Today's book-making budget is used up. New books can be made tomorrow.")
    for provider in providers_in_use():
        cap = settings.provider_budget_usd.get(provider)
        if cap is not None and await store.spent_total_usd(provider) >= cap:
            log.warning("Provider %s reached its lifetime budget of $%.2f", provider, cap)
            raise HTTPException(429, "Book making is paused: the AI credit budget has been reached.")


def _finish_task(task: asyncio.Task) -> None:
    _tasks.discard(task)
    if not task.cancelled() and task.exception():
        log.error("Pipeline crashed", exc_info=task.exception())


def _is_owner(owner_id: str | None, user: User | None) -> bool:
    # Books made before sign-in existed have no owner; anyone with the link may see those drafts.
    return owner_id is None or (user is not None and user.id == owner_id)


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str, user: MaybeSignedIn) -> Job:
    job = await store.get_job(job_id)
    if not job or not _is_owner(job.owner_id, user):
        raise HTTPException(404, "No job with that id.")
    return job


@app.get("/api/books")
async def list_books() -> list[Book]:
    return await store.list_books(published_only=True)


@app.get("/api/me/books")
async def my_books(user: SignedIn) -> list[Book]:
    return await store.list_books_by_owner(user.id)


async def _readable_book(book_id: str, user: User | None) -> Book:
    book = await store.get_book(book_id)
    if not book or (book.status != "published" and not _is_owner(book.owner_id, user)):
        raise HTTPException(404, "No book with that id.")
    return book


async def _owned_book(book_id: str, user: User) -> Book:
    book = await store.get_book(book_id)
    if not book or book.owner_id != user.id:
        raise HTTPException(404, "No book with that id.")
    return book


@app.get("/api/books/{book_id}")
async def get_book(book_id: str, user: MaybeSignedIn) -> Book:
    return await _readable_book(book_id, user)


class PageEdits(BaseModel):
    """New text for each language version, page by page, in the book's existing order."""

    pages: list[list[StoryPage]] = Field(description="One list of pages per draft, in draft order.")
    titles: list[str]


@app.put("/api/books/{book_id}")
async def edit_book(book_id: str, edits: PageEdits, user: SignedIn) -> Book:
    book = await _owned_book(book_id, user)
    if len(edits.pages) != len(book.drafts) or len(edits.titles) != len(book.drafts):
        raise HTTPException(422, "Edits must cover every language version of the book.")
    for draft, pages, title in zip(book.drafts, edits.pages, edits.titles, strict=True):
        if [p.number for p in pages] != [p.number for p in draft.pages]:
            raise HTTPException(422, "Pages can be edited but not added, removed or reordered.")
        if not title.strip() or any(not p.text.strip() for p in pages):
            raise HTTPException(422, "Every page and title needs some text.")
        draft.title, draft.pages = title.strip(), pages
    await store.save_book(book)
    return book


class CorrectionRequest(Correction):
    book_id: str


@app.post("/api/corrections")
async def add_correction(fix: CorrectionRequest, user: SignedIn) -> Book:
    """Save a native speaker's fix for future books, and apply it to this book right away."""
    book = await _owned_book(fix.book_id, user)
    draft = next((d for d in book.drafts if d.language == fix.language), None)
    if draft is None:
        raise HTTPException(422, "This book has no version in that language.")
    in_words = any(w.words.get(fix.language) == fix.wrong for ws in book.words.values() for w in ws)
    if not in_words and not any(fix.wrong in p.text or fix.wrong in draft.title for p in draft.pages):
        raise HTTPException(422, f"“{fix.wrong}” doesn't appear in this book.")
    draft.title = draft.title.replace(fix.wrong, fix.right_text)
    for page in draft.pages:
        page.text = page.text.replace(fix.wrong, fix.right_text)
    correction = Correction(**fix.model_dump(exclude={"book_id"}))
    apply_corrections(book.words, [correction])
    await store.save_correction(correction, book.id, user.id)
    await store.save_book(book)
    return book


@app.get("/api/corrections/{language}")
async def list_corrections(language: str, user: SignedIn) -> list[Correction]:
    return await store.list_corrections(language)


class RedrawRequest(BaseModel):
    # What the adult wants changed, e.g. "the tiger's head faces the wrong way".
    note: str | None = Field(default=None, max_length=300)


@app.post("/api/books/{book_id}/pages/{number}/redraw", status_code=202)
async def redraw_book_page(book_id: str, number: int, fix: RedrawRequest, user: SignedIn) -> Job:
    """Redraws one picture in the background; the job shows progress like making a book."""
    book = await _owned_book(book_id, user)
    if not any(p.number == number for p in book.plan.pages):
        raise HTTPException(404, "This book has no such page.")
    maker = get_image_maker()
    if maker is None:
        raise HTTPException(503, "Pictures can't be drawn right now.")
    await check_budget()
    job = Job(request=book.request, owner_id=user.id, book_id=book.id)
    await store.save_job(job)
    note = fix.note.strip() if fix.note else None
    task = asyncio.create_task(
        redraw_page(get_client(), job, store, book, number, note or None, maker, get_segmenter())
    )
    _tasks.add(task)
    task.add_done_callback(_finish_task)
    return job


@app.post("/api/books/{book_id}/publish")
async def publish_book(book_id: str, user: SignedIn) -> Book:
    book = await _owned_book(book_id, user)
    if book.status != "published":
        book.status = "published"
        book.published_at = datetime.now(UTC)
        await store.save_book(book)
    return book

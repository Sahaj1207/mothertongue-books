import asyncio
import logging
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.agents.client import get_client
from app.agents.schemas import BookRequest
from app.config import settings
from app.models import Book, Job
from app.pipeline import run_pipeline
from app.store import store

log = logging.getLogger("mothertongue")

app = FastAPI(title="MotherTongue Books API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_tasks: set[asyncio.Task] = set()


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "mock_ai": settings.use_mock_ai, "storage": type(store).__name__}


@app.post("/api/books", status_code=202)
async def create_book(request: BookRequest) -> Job:
    if not settings.use_mock_ai and await store.spent_today_usd() >= settings.daily_budget_usd:
        raise HTTPException(429, "Today's book-making budget is used up. New books can be made tomorrow.")
    job = Job(request=request)
    await store.save_job(job)
    task = asyncio.create_task(run_pipeline(get_client(), job, store))
    _tasks.add(task)
    task.add_done_callback(_finish_task)
    return job


def _finish_task(task: asyncio.Task) -> None:
    _tasks.discard(task)
    if not task.cancelled() and task.exception():
        log.error("Pipeline crashed", exc_info=task.exception())


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> Job:
    job = await store.get_job(job_id)
    if not job:
        raise HTTPException(404, "No job with that id.")
    return job


@app.get("/api/books")
async def list_books() -> list[Book]:
    return await store.list_books(published_only=True)


@app.get("/api/books/{book_id}")
async def get_book(book_id: str) -> Book:
    book = await store.get_book(book_id)
    if not book:
        raise HTTPException(404, "No book with that id.")
    return book


@app.post("/api/books/{book_id}/publish")
async def publish_book(book_id: str) -> Book:
    # Temporary until the review-and-approve screen (Day 4) adds sign-in and edits.
    book = await store.get_book(book_id)
    if not book:
        raise HTTPException(404, "No book with that id.")
    if book.status != "published":
        book.status = "published"
        book.published_at = datetime.now(UTC)
        await store.save_book(book)
    return book

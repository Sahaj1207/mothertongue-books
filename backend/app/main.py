import asyncio
import logging

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
    return {"ok": True, "mock_ai": settings.use_mock_ai}


@app.post("/api/books", status_code=202)
async def create_book(request: BookRequest) -> Job:
    job = Job(request=request)
    store.jobs[job.id] = job
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
    if job_id not in store.jobs:
        raise HTTPException(404, "No job with that id.")
    return store.jobs[job_id]


@app.get("/api/books")
async def list_books() -> list[Book]:
    return sorted(store.books.values(), key=lambda b: b.created_at, reverse=True)


@app.get("/api/books/{book_id}")
async def get_book(book_id: str) -> Book:
    if book_id not in store.books:
        raise HTTPException(404, "No book with that id.")
    return store.books[book_id]

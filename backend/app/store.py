"""Storage for jobs and books: Supabase in the app, in memory for tests and local runs without keys."""

from datetime import UTC, datetime
from typing import Protocol

import httpx

from app.config import settings
from app.models import Book, Job


class Store(Protocol):
    async def save_job(self, job: Job) -> None: ...
    async def get_job(self, job_id: str) -> Job | None: ...
    async def save_book(self, book: Book) -> None: ...
    async def get_book(self, book_id: str) -> Book | None: ...
    async def list_books(self, published_only: bool = True) -> list[Book]: ...


class MemoryStore:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.books: dict[str, Book] = {}

    async def save_job(self, job: Job) -> None:
        self.jobs[job.id] = job

    async def get_job(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    async def save_book(self, book: Book) -> None:
        self.books[book.id] = book

    async def get_book(self, book_id: str) -> Book | None:
        return self.books.get(book_id)

    async def list_books(self, published_only: bool = True) -> list[Book]:
        books = [b for b in self.books.values() if b.status == "published" or not published_only]
        return sorted(books, key=lambda b: b.published_at or b.created_at, reverse=True)


class SupabaseStore:
    """Talks to Supabase's REST API with the service key, so row-level security doesn't apply here."""

    def __init__(self, url: str, service_key: str) -> None:
        self.http = httpx.AsyncClient(
            base_url=f"{url}/rest/v1",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            timeout=15,
        )

    async def _upsert(self, table: str, row: dict) -> None:
        r = await self.http.post(
            f"/{table}", json=row, headers={"Prefer": "resolution=merge-duplicates,return=minimal"}
        )
        r.raise_for_status()

    async def _select(self, table: str, params: dict) -> list[dict]:
        r = await self.http.get(f"/{table}", params={"select": "*", **params})
        r.raise_for_status()
        return r.json()

    async def save_job(self, job: Job) -> None:
        row = job.model_dump(mode="json", include={"id", "status", "request", "steps", "book_id", "message"})
        await self._upsert("jobs", row | {"updated_at": datetime.now(UTC).isoformat()})

    async def get_job(self, job_id: str) -> Job | None:
        rows = await self._select("jobs", {"id": f"eq.{job_id}"})
        return Job.model_validate(rows[0]) if rows else None

    async def save_book(self, book: Book) -> None:
        req = book.request
        await self._upsert(
            "books",
            {
                "id": book.id,
                "language": req.language,
                "pair_language": req.pair_language,
                "level": req.level,
                "kind": req.kind,
                "topic": req.topic,
                "plan": book.plan.model_dump(mode="json"),
                "drafts": [d.model_dump(mode="json") for d in book.drafts],
                "status": book.status,
                "created_at": book.created_at.isoformat(),
                "published_at": book.published_at.isoformat() if book.published_at else None,
            },
        )

    async def get_book(self, book_id: str) -> Book | None:
        rows = await self._select("books", {"id": f"eq.{book_id}"})
        return _book_from_row(rows[0]) if rows else None

    async def list_books(self, published_only: bool = True) -> list[Book]:
        params = {"order": "published_at.desc.nullslast,created_at.desc", "limit": "200"}
        if published_only:
            params["status"] = "eq.published"
        return [_book_from_row(r) for r in await self._select("books", params)]


def _book_from_row(row: dict) -> Book:
    request = {k: row[k] for k in ("language", "pair_language", "level", "kind", "topic")}
    return Book.model_validate(
        {
            "id": row["id"],
            "request": request,
            "plan": row["plan"],
            "drafts": row["drafts"],
            "status": row["status"],
            "created_at": row["created_at"],
            "published_at": row["published_at"],
        }
    )


def make_store() -> Store:
    if settings.supabase_url and settings.supabase_service_key:
        return SupabaseStore(settings.supabase_url, settings.supabase_service_key)
    return MemoryStore()


store = make_store()

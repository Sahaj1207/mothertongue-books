"""In-memory storage while building. Replaced by Supabase once the project is set up."""

from app.models import Book, Job


class MemoryStore:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.books: dict[str, Book] = {}


store = MemoryStore()

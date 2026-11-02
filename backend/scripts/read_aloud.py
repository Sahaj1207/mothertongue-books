"""Makes Meta-voice clips for published books ahead of time (new books get theirs when published).

Run from backend/:  uv run python -m scripts.read_aloud [<book-id> ...]
With no ids it does every published book. Clips already made are skipped.
"""

import asyncio
import sys

from app.speech import get_voice, prepare_book
from app.store import store


async def main(ids: list[str]) -> None:
    voice = get_voice()
    if voice is None:
        sys.exit("No voice: USE_MOCK_AI must be false.")
    books = [await store.get_book(i) for i in ids] if ids else await store.list_books(published_only=True)
    # A few books at a time, so the voice's containers stay busy without a queue piling up.
    gate = asyncio.Semaphore(4)

    async def one(book) -> None:
        async with gate:
            done = await prepare_book(voice, book)
            print(f"{book.drafts[0].language} {book.drafts[0].title}: {done} clips", flush=True)

    await asyncio.gather(*(one(b) for b in books if b))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))

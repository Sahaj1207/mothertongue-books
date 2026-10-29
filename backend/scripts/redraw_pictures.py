"""Redraws a book's pictures and finds its tap words again, keeping the story and its text notes.

Run from backend/:  uv run python -m scripts.redraw_pictures <book-id>
"""

import asyncio
import sys

from app.agents.client import get_client
from app.main import get_image_maker
from app.models import Job
from app.pipeline import Run, build_steps
from app.segmentation import get_segmenter
from app.store import store
from app.usage import UsageMeter, current_meter


async def main(book_id: str) -> None:
    book = await store.get_book(book_id)
    if book is None:
        sys.exit(f"No book {book_id}")
    maker, segmenter = get_image_maker(), get_segmenter()
    if maker is None:
        sys.exit("No illustrator configured (USE_MOCK_AI must be false and the Cloudflare keys set).")

    book.review_notes = [n for n in book.review_notes if " picture: " not in n]
    book.images, book.words = {}, {}
    job = Job(request=book.request, owner_id=book.owner_id)
    job.steps = build_steps(job, illustrate=True, tap_words=segmenter is not None)
    meter = UsageMeter()
    current_meter.set(meter)

    # A throwaway job: progress goes to memory, not to the jobs table.
    run = Run(get_client(), job, _NoJobs())
    drawn = await run.illustrate(maker, book)
    if segmenter is not None:
        await run.find_tap_words(segmenter, book, drawn)
    await store.save_book(book)
    await store.save_usage(None, meter.entries)
    print(f"{len(book.images)} pictures, {sum(map(len, book.words.values()))} words, ${meter.cost_usd:.4f}")
    for note in book.review_notes:
        print("-", note)


class _NoJobs:
    def __getattr__(self, name):
        return getattr(store, name)

    async def save_job(self, job) -> None:
        pass


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))

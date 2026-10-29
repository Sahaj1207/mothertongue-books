"""Runs the story agents in order and saves each step on the job, so the UI can show live progress."""

import asyncio
import logging
import secrets

from app.agents import agents
from app.agents.agents import LANGUAGE_NAMES
from app.agents.client import ModelClient
from app.agents.schemas import PictureCheck, StoryDraft, StoryPlan
from app.config import settings
from app.illustrations import ImageMaker, checker_copy, draw_pages, scene_looks, web_copy
from app.models import Book, Job, Step, TapWord
from app.segmentation import Segmenter, apply_corrections, harmonize, largest
from app.store import Store
from app.usage import UsageMeter, current_meter

log = logging.getLogger("mothertongue")


class StoryRejected(Exception):
    pass


def story_languages(job: Job) -> list[str]:
    req = job.request
    return [req.language, req.pair_language] if req.pair_language else [req.language]


def build_steps(job: Job, illustrate: bool = False, tap_words: bool = False) -> list[Step]:
    steps = [
        Step(key="topic_check", label="Checking the topic"),
        Step(key="planner", label="Planning the story"),
    ]
    for lang in story_languages(job):
        steps += [
            Step(key=f"writer:{lang}", label="Writing the story"),
            Step(key=f"reading_level:{lang}", label="Checking the reading level"),
            Step(key=f"safety:{lang}", label="Safety review"),
        ]
    if illustrate:
        steps.append(
            Step(key="illustrator", label="Drawing and checking the pictures", model="FLUX.1 + Muse Spark")
        )
        if tap_words:
            steps.append(Step(key="tap_words", label="Finding words to tap", model="Muse Spark + SAM 3.1"))
    return steps


class Run:
    """One pipeline run: the job, where to save it, and the model client."""

    def __init__(self, client: ModelClient, job: Job, store: Store) -> None:
        self.client, self.job, self.store = client, job, store
        self.notes: list[str] = []

    async def save(self) -> None:
        await self.store.save_job(self.job)

    async def step(self, key: str, coro):
        step = self.job.step(key)
        step.status = "running"
        await self.save()
        try:
            result = await coro
        except Exception:
            step.status = "failed"
            raise
        step.status = "done"
        await self.save()
        return result

    async def illustrate(
        self, maker: ImageMaker, book: Book, only: set[int] | None = None, hint: str | None = None
    ) -> dict[int, bytes]:
        """Draws and stores the pictures (or just the pages in `only`, with a fresh seed).

        A failure here keeps the story and leaves pictures out.
        """
        step = self.job.step("illustrator")
        step.status = "running"
        step.detail = f"0 of {len(only or book.plan.pages)}"
        await self.save()

        async def progress(done: int, total: int, redrawing: int | None = None) -> None:
            step.detail = f"Redrawing page {redrawing}" if redrawing else f"{done} of {total}"
            await self.save()

        async def check(data: bytes, page) -> PictureCheck:
            looks = scene_looks(book.plan, page)
            return await agents.check_picture(self.client, checker_copy(data), page.scene, looks)

        drawn = {}
        try:
            drawn = await draw_pages(
                maker,
                book.plan,
                book.id,
                progress,
                check,
                only=only,
                # A redraw that reused the book's seed would draw the same picture again.
                seed_offset=secrets.randbelow(1_000_000) if only else 0,
                hints=[hint] if hint else None,
            )
            for number, drawing in sorted(drawn.items()):
                book.images[number] = await self.store.save_image(
                    book.id, number, web_copy(drawing.data), "image/webp"
                )
                prefix = f"Page {number} picture: "
                book.review_notes = [n for n in book.review_notes if not n.startswith(prefix)]
                book.review_notes += [prefix + p for p in drawing.unresolved]
            await self.store.save_book(book)
        except Exception:
            log.exception("Illustration failed for book %s", book.id)
        missing = len(only) - len(drawn) if only else len(book.plan.pages) - len(book.images)
        step.status = "done" if not missing else "failed"
        step.detail = None if not missing else f"{missing} pictures missing"
        await self.save()
        return {n: d.data for n, d in drawn.items() if n in book.images}

    async def find_tap_words(self, segmenter: Segmenter, book: Book, drawn: dict[int, bytes]) -> None:
        """Picks objects in each picture with Muse Spark, locates them with SAM 3.1. Optional: never fails a book."""
        step = self.job.step("tap_words")
        step.status = "running"
        await self.save()
        languages = [d.language for d in book.drafts]
        limit = asyncio.Semaphore(settings.illustration_concurrency)

        async def page_words(number: int, data: bytes) -> list[TapWord]:
            texts = {d.language: p.text for d in book.drafts for p in d.pages if p.number == number}
            async with limit:
                found = await agents.find_objects(self.client, checker_copy(data), texts, languages)
                words = []
                for obj in found.objects[:4]:
                    sam_image, mime = checker_copy(data, size=768)
                    box = largest(await segmenter.boxes(sam_image, mime, obj.english))
                    names = {w.language: w.word for w in obj.words if w.language in languages}
                    if box and names:
                        words.append(TapWord(english=obj.english, words=names, box=box))
                return words

        results = await asyncio.gather(*(page_words(n, d) for n, d in drawn.items()), return_exceptions=True)
        for number, result in zip(drawn, results, strict=True):
            # A redrawn page's old boxes point at things that may have moved or gone.
            book.words.pop(number, None)
            if isinstance(result, Exception):
                log.warning("Tap words failed for page %s: %s", number, result)
            elif result:
                book.words[number] = result
        harmonize(book.words)
        for lang in languages:
            apply_corrections(book.words, await self.store.list_corrections(lang))
        await self.store.save_book(book)
        step.status = "done" if book.words else "failed"
        step.detail = f"{sum(len(w) for w in book.words.values())} words" if book.words else "No words found"
        await self.save()

    async def write_and_review(self, plan: StoryPlan, lang: str) -> StoryDraft:
        level = self.job.request.level
        writer, reading, safety = (
            self.job.step(f"{k}:{lang}") for k in ("writer", "reading_level", "safety")
        )
        feedback: list[str] | None = None
        corrections = await self.store.list_corrections(lang)

        for attempt in range(settings.max_writer_retries + 1):
            writer.status = "running"
            writer.detail = f"Rewriting with reviewer notes (try {attempt + 1})" if attempt else None
            await self.save()
            draft = await agents.write_story(self.client, plan, lang, level, feedback, corrections)
            writer.status = "done"

            reading.status = safety.status = "running"
            reading.detail = safety.detail = None
            await self.save()
            level_review, safety_review = await asyncio.gather(
                agents.check_reading_level(self.client, draft, level),
                agents.review_safety(self.client, draft),
            )
            for step, review in ((reading, level_review), (safety, safety_review)):
                step.status = "done" if review.passed else "failed"
                step.detail = None if review.passed else f"{len(review.problems)} to fix"
            await self.save()

            if level_review.passed and safety_review.passed:
                writer.detail = "Improved after review" if attempt else None
                await self.save()
                return draft
            feedback = level_review.problems + safety_review.problems

        if not safety_review.passed:
            raise StoryRejected(
                f"The {LANGUAGE_NAMES[lang]} story didn't pass the safety review after "
                f"{settings.max_writer_retries + 1} tries. Try a different topic."
            )
        # Safe but still not quite at the reading level: keep it, and hand the notes to the adult reviewer.
        writer.detail = "Improved after review"
        reading.detail = "Notes for your review"
        self.notes += [f"{LANGUAGE_NAMES[lang]}: {p}" for p in level_review.problems]
        return draft


async def run_pipeline(
    client: ModelClient,
    job: Job,
    store: Store,
    image_maker: ImageMaker | None = None,
    segmenter: Segmenter | None = None,
) -> None:
    illustrate = image_maker is not None
    job.steps = build_steps(job, illustrate=illustrate, tap_words=illustrate and segmenter is not None)
    for step in job.steps:
        if step.key not in ("illustrator", "tap_words"):
            step.model = client.model_name(step.key.split(":")[0])
    run = Run(client, job, store)
    meter = UsageMeter()
    meter_token = current_meter.set(meter)
    try:
        topic = await run.step("topic_check", agents.check_topic(client, job.request))
        if not topic.allowed:
            job.step("topic_check").status = "failed"
            job.status = "blocked"
            job.message = topic.reason
            return

        plan = await run.step("planner", agents.plan_story(client, job.request))
        drafts = [await run.write_and_review(plan, lang) for lang in story_languages(job)]

        book = Book(
            request=job.request, plan=plan, drafts=drafts, review_notes=run.notes, owner_id=job.owner_id
        )
        await store.save_book(book)
        job.book_id = book.id
        if image_maker is not None:
            drawn = await run.illustrate(image_maker, book)
            if segmenter is not None:
                await run.find_tap_words(segmenter, book, drawn)
        job.status = "done"
    except StoryRejected as exc:
        job.status = "failed"
        job.message = str(exc)
    except Exception:
        job.status = "failed"
        job.message = "Something went wrong while making the book. Try again."
        raise
    finally:
        current_meter.reset(meter_token)
        job.cost_usd = round(meter.cost_usd, 6)
        await store.save_usage(job.id, meter.entries)
        await run.save()


async def redraw_page(
    client: ModelClient,
    job: Job,
    store: Store,
    book: Book,
    number: int,
    hint: str | None,
    image_maker: ImageMaker,
    segmenter: Segmenter | None = None,
) -> None:
    """Redraws one page the adult wasn't happy with, then finds its tap words again."""
    job.steps = [
        Step(key="illustrator", label=f"Redrawing page {number}", model="FLUX.1 + Muse Spark"),
        *(
            [Step(key="tap_words", label="Finding words to tap", model="Muse Spark + SAM 3.1")]
            if segmenter
            else []
        ),
    ]
    run = Run(client, job, store)
    meter = UsageMeter()
    meter_token = current_meter.set(meter)
    try:
        drawn = await run.illustrate(image_maker, book, only={number}, hint=hint)
        if not drawn:
            job.status = "failed"
            job.message = "The picture couldn't be drawn. Try again in a minute."
            return
        if segmenter is not None:
            await run.find_tap_words(segmenter, book, drawn)
        job.status = "done"
    except Exception:
        job.status = "failed"
        job.message = "Something went wrong while redrawing. Try again."
        raise
    finally:
        current_meter.reset(meter_token)
        job.cost_usd = round(meter.cost_usd, 6)
        await store.save_usage(job.id, meter.entries)
        await store.save_job(job)

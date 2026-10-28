"""Runs the story agents in order and saves each step on the job, so the UI can show live progress."""

import asyncio
import logging

from app.agents import agents
from app.agents.agents import LANGUAGE_NAMES
from app.agents.client import ModelClient
from app.agents.schemas import StoryDraft, StoryPlan
from app.config import settings
from app.illustrations import ImageMaker, draw_pages
from app.models import Book, Job, Step
from app.store import Store
from app.usage import UsageMeter, current_meter

log = logging.getLogger("mothertongue")


class StoryRejected(Exception):
    pass


def story_languages(job: Job) -> list[str]:
    req = job.request
    return [req.language, req.pair_language] if req.pair_language else [req.language]


def build_steps(job: Job, illustrate: bool = False) -> list[Step]:
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
        steps.append(Step(key="illustrator", label="Drawing the pictures", model="FLUX.1 schnell"))
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

    async def illustrate(self, maker: ImageMaker, book: Book) -> None:
        """Draws and stores the pictures. A failure here keeps the story and leaves pictures out."""
        step = self.job.step("illustrator")
        step.status = "running"
        step.detail = f"0 of {len(book.plan.pages)}"
        await self.save()

        async def progress(done: int, total: int) -> None:
            step.detail = f"{done} of {total}"
            await self.save()

        try:
            drawn = await draw_pages(maker, book.plan, book.id, progress)
            for number, data in sorted(drawn.items()):
                book.images[number] = await self.store.save_image(book.id, number, data)
            await self.store.save_book(book)
        except Exception:
            log.exception("Illustration failed for book %s", book.id)
        missing = len(book.plan.pages) - len(book.images)
        step.status = "done" if not missing else "failed"
        step.detail = None if not missing else f"{missing} pictures missing"
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
        reading.detail = "Notes for your review"
        self.notes += [f"{LANGUAGE_NAMES[lang]}: {p}" for p in level_review.problems]
        return draft


async def run_pipeline(
    client: ModelClient, job: Job, store: Store, image_maker: ImageMaker | None = None
) -> None:
    job.steps = build_steps(job, illustrate=image_maker is not None)
    for step in job.steps:
        if step.key != "illustrator":
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
            await run.illustrate(image_maker, book)
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

"""Runs the story agents in order and saves each step on the job, so the UI can show live progress."""

import asyncio

from app.agents import agents
from app.agents.agents import LANGUAGE_NAMES
from app.agents.client import ModelClient
from app.agents.schemas import StoryDraft, StoryPlan
from app.config import settings
from app.models import Book, Job, Step
from app.store import Store


class StoryRejected(Exception):
    pass


def story_languages(job: Job) -> list[str]:
    req = job.request
    return [req.language, req.pair_language] if req.pair_language else [req.language]


def build_steps(job: Job) -> list[Step]:
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
    return steps


class Run:
    """One pipeline run: the job, where to save it, and the model client."""

    def __init__(self, client: ModelClient, job: Job, store: Store) -> None:
        self.client, self.job, self.store = client, job, store

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

    async def write_and_review(self, plan: StoryPlan, lang: str) -> StoryDraft:
        level = self.job.request.level
        writer, reading, safety = (
            self.job.step(f"{k}:{lang}") for k in ("writer", "reading_level", "safety")
        )
        feedback: list[str] | None = None

        for attempt in range(settings.max_writer_retries + 1):
            writer.status = "running"
            writer.detail = f"Rewriting with reviewer notes (try {attempt + 1})" if attempt else None
            await self.save()
            draft = await agents.write_story(self.client, plan, lang, level, feedback)
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
                return draft
            feedback = level_review.problems + safety_review.problems

        raise StoryRejected(
            f"The {LANGUAGE_NAMES[lang]} story didn't pass review after "
            f"{settings.max_writer_retries + 1} tries. Try a simpler topic."
        )


async def run_pipeline(client: ModelClient, job: Job, store: Store) -> None:
    job.steps = build_steps(job)
    for step in job.steps:
        step.model = client.model_name(step.key.split(":")[0])
    run = Run(client, job, store)
    try:
        topic = await run.step("topic_check", agents.check_topic(client, job.request))
        if not topic.allowed:
            job.step("topic_check").status = "failed"
            job.status = "blocked"
            job.message = topic.reason
            return

        plan = await run.step("planner", agents.plan_story(client, job.request))
        drafts = [await run.write_and_review(plan, lang) for lang in story_languages(job)]

        book = Book(request=job.request, plan=plan, drafts=drafts)
        await store.save_book(book)
        job.book_id = book.id
        job.status = "done"
    except StoryRejected as exc:
        job.status = "failed"
        job.message = str(exc)
    except Exception:
        job.status = "failed"
        job.message = "Something went wrong while making the book. Try again."
        raise
    finally:
        await run.save()

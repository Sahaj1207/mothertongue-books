"""Runs the story agents in order and records each step on the job, so the UI can show live progress."""

import asyncio

from app.agents import agents
from app.agents.agents import LANGUAGE_NAMES
from app.agents.client import ModelClient
from app.agents.schemas import StoryDraft
from app.config import settings
from app.models import Book, Job, Step
from app.store import MemoryStore


class StoryRejected(Exception):
    pass


def build_steps(job: Job) -> list[Step]:
    req = job.request
    steps = [
        Step(key="topic_check", label="Checking the topic"),
        Step(key="planner", label="Planning the story"),
    ]
    for lang in story_languages(job):
        name = LANGUAGE_NAMES[lang]
        steps += [
            Step(key=f"writer:{lang}", label=f"Writing in {name}"),
            Step(key=f"reading_level:{lang}", label=f"Checking the {name} reading level"),
            Step(key=f"safety:{lang}", label=f"Safety review of the {name} story"),
        ]
    if req.kind == "folk-tale":
        steps[0].label = "Loading the folk tale outline"
    return steps


def story_languages(job: Job) -> list[str]:
    req = job.request
    return [req.language, req.pair_language] if req.pair_language else [req.language]


async def run_step(job: Job, key: str, coro, done_detail: str | None = None):
    step = job.step(key)
    step.status = "running"
    try:
        result = await coro
    except Exception:
        step.status = "failed"
        raise
    step.status = "done"
    step.detail = done_detail
    return result


async def write_and_review(client: ModelClient, job: Job, plan, lang: str) -> StoryDraft:
    level = job.request.level
    writer, reading, safety = (job.step(f"{k}:{lang}") for k in ("writer", "reading_level", "safety"))
    feedback: list[str] | None = None

    for attempt in range(settings.max_writer_retries + 1):
        writer.status = "running"
        writer.detail = f"Rewriting (attempt {attempt + 1})" if attempt else None
        draft = await agents.write_story(client, plan, lang, level, feedback)
        writer.status = "done"

        reading.status = safety.status = "running"
        reading.detail = safety.detail = None
        level_review, safety_review = await asyncio.gather(
            agents.check_reading_level(client, draft, level),
            agents.review_safety(client, draft),
        )
        for step, review in ((reading, level_review), (safety, safety_review)):
            step.status = "done" if review.passed else "failed"
            step.detail = None if review.passed else f"{len(review.problems)} to fix"

        if level_review.passed and safety_review.passed:
            return draft
        feedback = level_review.problems + safety_review.problems

    raise StoryRejected(
        f"The {LANGUAGE_NAMES[lang]} story didn't pass review after {settings.max_writer_retries + 1} tries."
    )


async def run_pipeline(client: ModelClient, job: Job, store: MemoryStore) -> None:
    job.steps = build_steps(job)
    try:
        topic = await run_step(job, "topic_check", agents.check_topic(client, job.request))
        if not topic.allowed:
            job.step("topic_check").status = "failed"
            job.status = "blocked"
            job.message = topic.reason
            return

        plan = await run_step(job, "planner", agents.plan_story(client, job.request))
        drafts = [await write_and_review(client, job, plan, lang) for lang in story_languages(job)]

        book = Book(request=job.request, plan=plan, drafts=drafts)
        store.books[book.id] = book
        job.book_id = book.id
        job.status = "done"
    except StoryRejected as exc:
        job.status = "failed"
        job.message = str(exc)
    except Exception:
        job.status = "failed"
        job.message = "Something went wrong while making the book. Try again."
        raise

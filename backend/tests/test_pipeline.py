import asyncio

import pytest

from app.agents.client import MockModelClient
from app.agents.schemas import BookRequest
from app.config import settings
from app.models import Job
from app.pipeline import run_pipeline
from app.store import MemoryStore


class ScriptedClient(MockModelClient):
    """Mock client whose reviews fail a set number of times before passing."""

    def __init__(self, review_failures: int = 0):
        super().__init__(delay=0)
        self.review_failures = review_failures
        self.calls: list[str] = []

    async def structured(self, *, agent, instructions, prompt, schema):
        self.calls.append(agent)
        if agent == "safety" and self.review_failures > 0:
            self.review_failures -= 1
            return schema.model_validate({"passed": False, "problems": ["Page 2: the dog is scary."]})
        return await super().structured(agent=agent, instructions=instructions, prompt=prompt, schema=schema)


def make_job(**overrides) -> Job:
    fields = {"language": "te", "level": 1, "topic": "sharing mangoes"} | overrides
    return Job(request=BookRequest(**fields))


def run(client, job) -> MemoryStore:
    store = MemoryStore()
    asyncio.run(run_pipeline(client, job, store))
    return store


def test_story_is_made_and_every_step_finishes():
    job = make_job()
    store = run(ScriptedClient(), job)

    assert job.status == "done"
    assert all(step.status == "done" for step in job.steps)
    assert store.jobs[job.id].status == "done"
    book = store.books[job.book_id]
    assert [d.language for d in book.drafts] == ["te"]
    assert len(book.drafts[0].pages) == len(book.plan.pages)


def test_unsuitable_topic_is_blocked_before_planning():
    job = make_job(topic="a story with a gun")
    client = ScriptedClient()
    run(client, job)

    assert job.status == "blocked"
    assert job.message
    assert client.calls == ["topic_check"]


def test_writer_rewrites_after_a_failed_review():
    job = make_job()
    client = ScriptedClient(review_failures=1)
    run(client, job)

    assert job.status == "done"
    assert client.calls.count("writer") == 2


def test_book_fails_when_reviews_never_pass():
    job = make_job()
    client = ScriptedClient(review_failures=99)
    store = run(client, job)

    assert job.status == "failed"
    assert job.book_id is None and not store.books
    assert client.calls.count("writer") == settings.max_writer_retries + 1


def test_two_language_book_writes_each_language_from_one_plan():
    job = make_job(kind="two-language", pair_language="en")
    client = ScriptedClient()
    store = run(client, job)

    assert job.status == "done"
    assert client.calls.count("planner") == 1
    assert [d.language for d in store.books[job.book_id].drafts] == ["te", "en"]


def test_two_language_book_needs_a_different_second_language():
    with pytest.raises(ValueError):
        BookRequest(language="te", level=1, topic="rain", kind="two-language", pair_language="te")

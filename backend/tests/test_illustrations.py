import asyncio

from app.agents.schemas import BookRequest, Character, PagePlan, StoryPlan
from app.illustrations import STYLE, book_seed, picture_prompt
from app.models import Job
from app.pipeline import run_pipeline
from app.store import MemoryStore
from tests.test_pipeline import ScriptedClient

PLAN = StoryPlan(
    title_en="Kite",
    setting="village",
    lesson="share",
    characters=[
        Character(name="Chinni", description="girl", look="six-year-old girl with two braids"),
        Character(name="Tata", description="grandfather", look="old man with white moustache"),
    ],
    pages=[PagePlan(number=1, event="e", scene="Chinni flies a kite on the roof.")],
)


def test_prompt_has_style_and_only_the_characters_in_the_scene():
    prompt = picture_prompt(PLAN, PLAN.pages[0])
    assert prompt.startswith(STYLE)
    assert "two braids" in prompt
    assert "white moustache" not in prompt


def test_every_page_of_a_book_uses_the_same_seed():
    assert book_seed("book-1") == book_seed("book-1") != book_seed("book-2")


class FakePainter:
    content_type = "image/webp"

    def __init__(self, fail_page: int | None = None):
        self.prompts: list[str] = []
        self.fail_page = fail_page

    async def draw(self, prompt: str, seed: int) -> bytes:
        self.prompts.append(prompt)
        if self.fail_page is not None and f"Picture {self.fail_page}:" in prompt:
            raise RuntimeError("GPU unavailable")
        return b"webp"


def make(painter):
    store = MemoryStore()
    job = Job(request=BookRequest(language="te", level=1, topic="kites"))
    asyncio.run(run_pipeline(ScriptedClient(), job, store, painter))
    return job, store.books[job.book_id], store


def test_pictures_are_drawn_stored_and_linked_to_pages():
    job, book, store = make(FakePainter())
    assert len(store.images) == len(book.images)
    assert job.status == "done"
    assert job.step("illustrator").status == "done"
    assert sorted(book.images) == [p.number for p in book.plan.pages]
    assert all(url.startswith("memory://") for url in book.images.values())


def test_a_failed_picture_keeps_the_book():
    job, book, _ = make(FakePainter(fail_page=2))
    assert job.status == "done"
    assert job.step("illustrator").status == "failed"
    assert 2 not in book.images and 1 in book.images
    assert job.step("illustrator").detail == "1 pictures missing"

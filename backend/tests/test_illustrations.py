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


def tiny_png() -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "orange").save(buf, format="PNG")
    return buf.getvalue()


PICTURE = tiny_png()


class FakePainter:
    content_type = "image/png"

    def __init__(self, fail_page: int | None = None):
        self.prompts: list[str] = []
        self.fail_page = fail_page

    async def draw(self, prompt: str, seed: int) -> bytes:
        self.prompts.append(prompt)
        if self.fail_page is not None and f"Picture {self.fail_page}:" in prompt:
            raise RuntimeError("GPU unavailable")
        return PICTURE


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


def check_with(verdicts):
    """A checker that returns the given verdicts in order: True = usable, a string = that problem."""
    remaining = list(verdicts)

    async def check(data, page):
        from app.agents.schemas import PictureCheck

        verdict = remaining.pop(0)
        if isinstance(verdict, Exception):
            raise verdict
        if verdict is True:
            return PictureCheck(problems=[], usable=True)
        return PictureCheck(problems=[verdict], usable=False)

    return check


async def ignore_progress(*args, **kwargs):
    pass


def draw(painter, check):
    from app.illustrations import draw_pages

    return asyncio.run(draw_pages(painter, PLAN, "book-1", ignore_progress, check))


def test_flawed_picture_is_redrawn_with_the_fix_in_the_prompt():
    painter = FakePainter()
    drawn = draw(painter, check_with(["Tata's head floats above his body", True]))

    assert len(painter.prompts) == 2
    assert "head floats above his body" in painter.prompts[1]
    assert "Tata" not in painter.prompts[1]
    assert drawn[1].unresolved == []


def test_problems_left_after_the_last_redraw_go_to_the_reviewer():
    painter = FakePainter()
    drawn = draw(painter, check_with(["extra hand"] * 3))

    assert len(painter.prompts) == 3  # first try plus two redraws
    assert drawn[1].unresolved == ["extra hand"]


def test_a_checker_outage_keeps_the_picture():
    drawn = draw(FakePainter(), check_with([RuntimeError("model down")]))
    assert drawn[1].data == PICTURE


def test_names_and_quoted_text_never_reach_the_picture_prompt():
    from app.illustrations import without_names

    text = without_names(PLAN, "Remove the text \"Chinni\" and the sign 'SCHOOL BUS'; Chinni's kite is fine.")
    assert "Chinni" not in text and "SCHOOL BUS" not in text
    assert "(six-year-old girl with two braids)'s kite" in text


def test_checker_gets_a_small_copy():
    import io

    from PIL import Image

    from app.illustrations import checker_copy

    buf = io.BytesIO()
    Image.new("RGB", (1024, 1024), "orange").save(buf, format="PNG")
    small, mime = checker_copy(buf.getvalue())
    assert mime == "image/jpeg"
    assert Image.open(io.BytesIO(small)).size == (512, 512)

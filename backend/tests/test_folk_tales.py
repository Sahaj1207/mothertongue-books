import pytest

from app.agents.schemas import BookRequest
from tests.test_api import OWNER, client_as, store  # noqa: F401  (store is a fixture)
from tests.test_pipeline import ScriptedClient, make_job, run

OUTLINE = """Punyakoti the cow goes to graze in the forest.
A hungry tiger stops her.
She asks to feed her calf one last time and promises to return.
She comes back as promised.
The tiger is moved by her honesty and lets her go."""


def folk(**overrides) -> dict:
    return {
        "language": "kn",
        "level": 2,
        "kind": "folk-tale",
        "topic": "Punyakoti",
        "source": "Kannada folk song",
        "outline": OUTLINE,
    } | overrides


def test_a_folk_tale_needs_an_outline():
    with pytest.raises(ValueError):
        BookRequest(**folk(outline=None))
    with pytest.raises(ValueError):
        BookRequest(language="kn", level=2, topic="rain", outline=OUTLINE)


def test_a_folk_tale_may_have_a_second_language():
    assert BookRequest(**folk(pair_language="en")).pair_language == "en"


class PromptRecorder(ScriptedClient):
    def __init__(self):
        super().__init__()
        self.prompts: dict[str, str] = {}

    async def structured(self, *, agent, instructions, prompt, schema, images=None):
        self.prompts[agent] = prompt
        return await super().structured(
            agent=agent, instructions=instructions, prompt=prompt, schema=schema, images=images
        )


def test_the_planner_retells_the_approved_outline():
    client = PromptRecorder()
    job = make_job(**folk())
    saved = run(client, job)

    assert job.status == "done"
    assert "tiger is moved by her honesty" in client.prompts["planner"]
    assert "Kannada folk song" in client.prompts["planner"]
    assert "tiger" in client.prompts["topic_check"]  # the outline is screened too, not just the name
    assert saved.books[job.book_id].request.source == "Kannada folk song"


def test_outline_helper_needs_sign_in(store):  # noqa: F811
    response = client_as(None).post("/api/folk-outline", json={"tale": "Punyakoti", "language": "kn"})
    assert response.status_code == 401


def test_outline_helper_drafts_steps_to_edit(store):  # noqa: F811
    response = client_as(OWNER).post(
        "/api/folk-outline", json={"tale": "the monkey and the crocodile", "language": "te"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["known"] is True
    assert len(body["beats"]) >= 6

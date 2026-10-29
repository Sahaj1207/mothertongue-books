import re
from pathlib import Path

import pytest

from app.agents.schemas import BookRequest
from app.illustrations import picture_prompt
from app.languages import LANGUAGES
from tests.test_pipeline import ScriptedClient, make_job, run

FRONTEND_LIST = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "languages.ts"


def test_backend_and_website_list_the_same_languages():
    # A language added on one side only would let people pick one the other side rejects.
    codes = re.findall(r"^\s+code: '(\w+)',", FRONTEND_LIST.read_text(encoding="utf-8"), flags=re.MULTILINE)
    assert sorted(codes) == sorted(LANGUAGES)


def test_new_languages_are_accepted():
    assert BookRequest(language="sw", level=1, topic="the market").language == "sw"
    assert BookRequest(language="ne", level=1, topic="kites", kind="two-language", pair_language="en")
    with pytest.raises(ValueError):
        BookRequest(language="xx", level=1, topic="the market")


class PromptRecorder(ScriptedClient):
    def __init__(self):
        super().__init__()
        self.instructions: dict[str, str] = {}

    async def structured(self, *, agent, instructions, prompt, schema, images=None):
        self.instructions[agent] = instructions
        return await super().structured(
            agent=agent, instructions=instructions, prompt=prompt, schema=schema, images=images
        )


def test_stories_are_planned_where_the_language_is_spoken():
    client = PromptRecorder()
    run(client, make_job(language="sw", topic="helping grandma at the market"))
    assert "Kenya and Tanzania" in client.instructions["planner"]
    assert "India" not in client.instructions["planner"]


def test_pictures_follow_the_plans_setting():
    from app.agents.schemas import PagePlan, StoryPlan

    plan = StoryPlan(
        title_en="Market",
        setting="A busy market in Nairobi",
        lesson="help",
        characters=[],
        pages=[PagePlan(number=1, event="e", scene="A girl carries a basket.")],
    )
    prompt = picture_prompt(plan, plan.pages[0])
    assert "Nairobi" in prompt and "Indian" not in prompt

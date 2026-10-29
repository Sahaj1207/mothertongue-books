import asyncio

import pytest

from app.agents.schemas import BookRequest
from app.models import Job
from app.pipeline import run_pipeline
from app.segmentation import largest, parse_boxes
from app.store import MemoryStore
from tests.test_illustrations import FakePainter
from tests.test_pipeline import ScriptedClient

SAM_OUTPUT = (
    "<0f>0<|box;x1=737;y1=76;x2=798;y2=156;w=1024;h=1024|><|mask;x=0;y=0;data=80,62,~abc|>,"
    "1<|box;x1=332;y1=47;x2=482;y2=249;w=1024;h=1024|><|mask;x=0;y=0;data=203,151,~def|>"
)


def test_sam_boxes_are_read_as_fractions_of_the_picture():
    boxes = parse_boxes(SAM_OUTPUT)
    assert len(boxes) == 2
    assert boxes[1] == pytest.approx((332 / 1024, 47 / 1024, 483 / 1024, 250 / 1024))


def test_the_biggest_match_is_the_one_to_tap():
    assert largest(parse_boxes(SAM_OUTPUT)) == parse_boxes(SAM_OUTPUT)[1]
    assert largest([]) is None


class WordFinder(ScriptedClient):
    async def structured(self, *, agent, instructions, prompt, schema, images=None):
        if agent == "object_finder":
            self.calls.append(agent)
            return schema.model_validate(
                {
                    "objects": [
                        {"english": "red kite", "words": [{"language": "te", "word": "గాలిపటం"}]},
                        {"english": "flying elephant", "words": [{"language": "te", "word": "ఏనుగు"}]},
                    ]
                }
            )
        return await super().structured(
            agent=agent, instructions=instructions, prompt=prompt, schema=schema, images=images
        )


class FakeSam:
    async def boxes(self, image, mime, phrase):
        # Only the kite is really in the picture.
        return parse_boxes(SAM_OUTPUT) if phrase == "red kite" else []


def test_objects_found_in_the_picture_become_tap_words():
    store = MemoryStore()
    job = Job(request=BookRequest(language="te", level=1, topic="kites"))
    asyncio.run(run_pipeline(WordFinder(), job, store, FakePainter(), FakeSam()))

    book = store.books[job.book_id]
    words = book.words[1]
    assert [w.english for w in words] == ["red kite"]  # the elephant wasn't found, so it isn't offered
    assert words[0].words == {"te": "గాలిపటం"}
    assert job.step("tap_words").status == "done"


def tap(english, word):
    from app.models import TapWord

    return TapWord(english=english, words={"kn": word}, box=(0, 0, 1, 1))


def test_the_same_object_gets_one_word_across_the_book():
    from app.segmentation import harmonize

    words = {
        1: [tap("yellow raincoat", "ರೈನ್‌ಕೋಟ್")],
        2: [tap("raincoat", "ಮಳೆಕೋಟ್")],
        3: [tap("yellow raincoat", "ರೈನ್‌ಕೋಟ್"), tap("yellow bus", "ಬಸ್")],
    }
    harmonize(words)
    assert {w.words["kn"] for ws in words.values() for w in ws if "raincoat" in w.english} == {"ರೈನ್‌ಕೋಟ್"}


def test_saved_corrections_fix_tap_words():
    from app.models import Correction
    from app.segmentation import apply_corrections

    words = {1: [tap("red sandal", "ಚಪ್ಪಲ್")]}
    apply_corrections(words, [Correction(language="kn", wrong="ಚಪ್ಪಲ್", right_text="ಚಪ್ಪಲಿ")])
    assert words[1][0].words["kn"] == "ಚಪ್ಪಲಿ"

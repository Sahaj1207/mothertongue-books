"""Tap-to-learn: Muse Spark picks objects worth tapping, SAM 3.1 finds where each one is in the picture."""

import base64
import re
from typing import Protocol

from openai import AsyncOpenAI

from app.config import settings
from app.models import TapWord
from app.usage import record_cost

# Meta's list price for SAM 3.1 image segmentation: $2.50 per 1,000 images.
SAM_USD_PER_IMAGE = 0.0025

_BOX = re.compile(r"\d+<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)")


class Segmenter(Protocol):
    async def boxes(
        self, image: bytes, mime: str, phrase: str
    ) -> list[tuple[float, float, float, float]]: ...


def parse_boxes(output: str) -> list[tuple[float, float, float, float]]:
    """Boxes from SAM's special-token text, as fractions of the picture (x1, y1, x2, y2)."""
    found = []
    for x1, y1, x2, y2, w, h in _BOX.findall(output):
        w, h = int(w), int(h)
        found.append((int(x1) / w, int(y1) / h, (int(x2) + 1) / w, (int(y2) + 1) / h))
    return found


def largest(boxes: list[tuple[float, float, float, float]]) -> tuple[float, float, float, float] | None:
    """The match a child actually sees: several kites match "red kite", the big one is the one to tap."""
    return max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), default=None)


class SamSegmenter:
    """SAM 3.1 on Meta Model API (Responses API, non-streaming)."""

    def __init__(self, api_key: str, base_url: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, max_retries=3, timeout=120)

    async def boxes(self, image: bytes, mime: str, phrase: str) -> list[tuple[float, float, float, float]]:
        url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
        response = await self.client.responses.create(
            model="sam-3.1",
            input=[
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": phrase},
                        {"type": "input_image", "image_url": url},
                    ],
                }
            ],
        )
        record_cost("meta", "sam-3.1", "sam", SAM_USD_PER_IMAGE)
        return parse_boxes(response.output_text or "")


def get_segmenter() -> Segmenter | None:
    if settings.use_mock_ai or not settings.model_api_key:
        return None
    return SamSegmenter(settings.model_api_key, settings.meta_base_url)


def harmonize(words: dict[int, list[TapWord]]) -> None:
    """One object, one word: the same thing on different pages gets the book's most common word for it.

    Pages are handled in parallel, so "yellow raincoat" can come back as several synonyms. Objects are
    matched by the last word of their English phrase ("raincoat"), which is the noun.
    """
    from collections import Counter

    chosen: dict[tuple[str, str], Counter] = {}
    for page_words in words.values():
        for w in page_words:
            noun = w.english.lower().split()[-1]
            for lang, word in w.words.items():
                chosen.setdefault((noun, lang), Counter())[word] += 1
    for page_words in words.values():
        for w in page_words:
            noun = w.english.lower().split()[-1]
            w.words = {lang: chosen[(noun, lang)].most_common(1)[0][0] for lang in w.words}


def apply_corrections(words: dict[int, list[TapWord]], corrections) -> None:
    """Native speakers' saved fixes apply to tap words as well as to the story text."""
    fixes = {(c.language, c.wrong): c.right_text for c in corrections}
    for page_words in words.values():
        for w in page_words:
            w.words = {lang: fixes.get((lang, word), word) for lang, word in w.words.items()}

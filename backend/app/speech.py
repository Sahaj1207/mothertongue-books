"""Read-aloud with Meta's MMS voices (voice_app.py on Modal). Each clip is made once and saved."""

import hashlib
import logging
from typing import Literal, Protocol

from app.config import settings
from app.models import Book
from app.store import store

log = logging.getLogger("mothertongue")

# Languages with an MMS voice; the others use the device's own voice.
META_VOICES = {"kn", "te", "mr", "sw", "ht", "eu"}
# A little slower than MMS's normal pace: pages for reading along, single words slower still.
RATES = {"page": 0.9, "word": 0.8}

Kind = Literal["page", "word"]


class Voice(Protocol):
    async def speak(self, language: str, text: str, rate: float) -> bytes: ...


class ModalVoice:
    def __init__(self, app_name: str) -> None:
        import modal

        self._speak = modal.Cls.from_name(app_name, "Voice")().speak

    async def speak(self, language: str, text: str, rate: float) -> bytes:
        return await self._speak.remote.aio(language, text, rate)


def get_voice() -> Voice | None:
    if settings.use_mock_ai:
        return None
    return ModalVoice(settings.voice_app)


def speech_key(language: str, text: str, rate: float) -> str:
    return hashlib.sha256(f"mms|{language}|{rate}|{text}".encode()).hexdigest()[:32]


def readable_texts(book: Book, language: str) -> dict[str, Kind]:
    """Everything in a book that may be read aloud in a language: its title, pages and tap words."""
    texts: dict[str, Kind] = {}
    for draft in book.drafts:
        if draft.language == language:
            texts[draft.title] = "page"
            texts.update({p.text: "page" for p in draft.pages})
    for words in book.words.values():
        for w in words:
            if word := w.words.get(language):
                texts[word] = "word"
    return texts


async def clip_url(voice: Voice, language: str, text: str, kind: Kind) -> str:
    rate = RATES[kind]
    key = speech_key(language, text, rate)
    if url := await store.speech_url(key):
        return url
    return await store.save_speech(key, await voice.speak(language, text, rate))


async def prepare_book(voice: Voice, book: Book) -> int:
    """Makes every clip a book needs ahead of time, so readers never wait. Returns how many it has."""
    done = 0
    for language in {d.language for d in book.drafts} & META_VOICES:
        for text, kind in readable_texts(book, language).items():
            try:
                await clip_url(voice, language, text, kind)
                done += 1
            except Exception:
                log.exception("Read-aloud failed for book %s (%s)", book.id, language)
    return done

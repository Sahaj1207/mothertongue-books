"""Read-aloud with Meta's MMS voices (voice_app.py on Modal). Each clip is made once and saved.

Before a page or title is saved, Meta's Muse Voice Transcribe listens to it; if what it hears doesn't
match the text, it is read again with another seed and the closest reading is kept. Single tap words
aren't checked: on all 226 of ours the transcriber heard almost nothing (a mean match of 0.10), since
a lone word gives it no context.
"""

import difflib
import hashlib
import json
import logging
import unicodedata
from typing import Literal, Protocol, TypedDict

import httpx

from app.config import settings
from app.models import Book
from app.store import store
from app.usage import UsageMeter, current_meter, record_cost

log = logging.getLogger("mothertongue")

# Languages with an MMS voice; the others use the device's own voice.
META_VOICES = {"kn", "te", "mr", "sw", "ht", "eu"}
# A little slower than MMS's normal pace: pages for reading along, single words slower still.
RATES = {"page": 0.9, "word": 0.8}
# Less sampling noise than MMS's default (0.667): steadier speech, which Muse Voice Transcribe heard
# best when we compared settings on 12 Kannada, Telugu and Marathi pages.
NOISE = 0.35
# A reading Muse Voice Transcribe matches this closely is kept; below it, another reading is tried.
GOOD_MATCH = 0.75
READINGS = 3
TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0"
TRANSCRIBE_USD_PER_SECOND = 3.0 / 1000 / 60

Kind = Literal["page", "word"]


class Clip(TypedDict):
    mp3: bytes
    wav: bytes


class Voice(Protocol):
    async def speak(self, language: str, text: str, rate: float, seed: int) -> Clip: ...


class Listener(Protocol):
    async def hear(self, wav: bytes) -> str: ...


class ModalVoice:
    def __init__(self, app_name: str) -> None:
        import modal

        self._speak = modal.Cls.from_name(app_name, "Voice")().speak

    async def speak(self, language: str, text: str, rate: float, seed: int) -> Clip:
        return await self._speak.remote.aio(language, text, rate, NOISE, seed)


class MuseTranscribe:
    def __init__(self, api_key: str) -> None:
        self.http = httpx.AsyncClient(
            base_url=settings.meta_base_url, headers={"Authorization": f"Bearer {api_key}"}, timeout=120
        )

    async def hear(self, wav: bytes) -> str:
        request = {"model": TRANSCRIBE_MODEL, "audioEncoding": "WAV", "sampleRate": 16000}
        r = await self.http.post(
            "/asr/transcribe",
            files={
                "request": (None, json.dumps(request), "application/json"),
                "audio": ("clip.wav", wav, "audio/wav"),
            },
        )
        r.raise_for_status()
        body = r.json()
        record_cost(
            "meta",
            TRANSCRIBE_MODEL,
            "read_aloud_check",
            body.get("audioDurationMs", 0) / 1000 * TRANSCRIBE_USD_PER_SECOND,
        )
        return body["transcript"]


def get_voice() -> Voice | None:
    if settings.use_mock_ai:
        return None
    return ModalVoice(settings.voice_app)


def get_listener() -> Listener | None:
    if settings.use_mock_ai or not settings.model_api_key:
        return None
    return MuseTranscribe(settings.model_api_key)


def speech_key(language: str, text: str, rate: float) -> str:
    return hashlib.sha256(f"mms2|{language}|{rate}|{text}".encode()).hexdigest()[:32]


def _letters(text: str) -> str:
    """Letters and vowel signs only, with every Indian script folded onto one.

    Muse Voice Transcribe sometimes writes the right words in a neighbouring script (a Telugu clip in
    Kannada letters, Marathi in Gujarati). Unicode lays the Indian scripts out in parallel blocks of
    128 from Devanagari (U+0900) to Malayalam (U+0D7F), so a letter's place in its block says how it sounds.
    """
    out = []
    for c in text:
        if unicodedata.category(c)[0] not in "LMN":  # Python's \w would drop Indic vowel signs
            continue
        code = ord(c)
        out.append(chr(0x900 + (code & 0x7F)) if 0x900 <= code <= 0xD7F else c)
    return "".join(out)


def match(text: str, heard: str) -> float:
    """How closely a transcript matches the text, on letters only (spaces and punctuation vary)."""
    return difflib.SequenceMatcher(None, _letters(text), _letters(heard)).ratio()


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


async def best_reading(
    voice: Voice, listener: Listener | None, language: str, text: str, rate: float
) -> bytes:
    """Up to three readings, stopping at the first that is heard as the text; the closest one wins."""
    best: tuple[float, bytes] | None = None
    for seed in range(READINGS):
        clip = await voice.speak(language, text, rate, seed)
        if listener is None:
            return clip["mp3"]
        try:
            score = match(text, await listener.hear(clip["wav"]))
        except Exception:
            log.exception("Muse Voice Transcribe failed; keeping the reading unchecked")
            return clip["mp3"]
        if best is None or score > best[0]:
            best = (score, clip["mp3"])
        if score >= GOOD_MATCH:
            break
    if best[0] < GOOD_MATCH:
        log.warning("Best reading of %r (%s) matched only %.2f", text[:40], language, best[0])
    return best[1]


async def clip_url(voice: Voice, listener: Listener | None, language: str, text: str, kind: Kind) -> str:
    rate = RATES[kind]
    key = speech_key(language, text, rate)
    if url := await store.speech_url(key):
        return url
    meter = UsageMeter()
    token = current_meter.set(meter)
    try:
        mp3 = await best_reading(voice, listener if kind == "page" else None, language, text, rate)
    finally:
        current_meter.reset(token)
        if meter.entries:
            await store.save_usage(None, meter.entries)
    return await store.save_speech(key, mp3)


async def prepare_book(voice: Voice, listener: Listener | None, book: Book) -> int:
    """Makes every clip a book needs ahead of time, so readers never wait. Returns how many it has."""
    done = 0
    for language in {d.language for d in book.drafts} & META_VOICES:
        for text, kind in readable_texts(book, language).items():
            try:
                await clip_url(voice, listener, language, text, kind)
                done += 1
            except Exception:
                log.exception("Read-aloud failed for book %s (%s)", book.id, language)
    return done

import pytest
from fastapi.testclient import TestClient

from app import main, share, speech
from app.agents.schemas import BookRequest, StoryDraft, StoryPage, StoryPlan
from app.auth import User, optional_user, require_user
from app.models import Book, TapWord
from app.store import MemoryStore

OWNER = User(id="owner-1", email="parent@example.com")
OTHER = User(id="other-2", email="someone@example.com")


@pytest.fixture
def store(monkeypatch):
    s = MemoryStore()
    monkeypatch.setattr(main, "store", s)
    monkeypatch.setattr(share, "store", s)
    monkeypatch.setattr(speech, "store", s)
    return s


def client_as(user: User | None) -> TestClient:
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides[optional_user] = lambda: user
    if user is not None:
        main.app.dependency_overrides[require_user] = lambda: user
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_overrides():
    yield
    main.app.dependency_overrides.clear()


def draft_book(store: MemoryStore, owner: User = OWNER) -> Book:
    plan = StoryPlan(
        title_en="Mangoes",
        setting="village",
        lesson="share",
        characters=[],
        pages=[{"number": n, "event": "e", "scene": "s"} for n in (1, 2)],
    )
    book = Book(
        request=BookRequest(language="te", level=1, topic="mangoes"),
        plan=plan,
        drafts=[
            StoryDraft(
                language="te",
                title="పింకీ మామిడి",
                pages=[StoryPage(number=1, text="పింకీ వచ్చాడు."), StoryPage(number=2, text="పింకీ నవ్వింది.")],
            )
        ],
        owner_id=owner.id,
    )
    store.books[book.id] = book
    return book


def test_making_a_book_requires_sign_in(store):
    response = TestClient(main.app).post("/api/books", json={"language": "te", "level": 1, "topic": "rain"})
    assert response.status_code == 401


def test_drafts_are_private_to_their_owner(store):
    book = draft_book(store)
    assert client_as(OWNER).get(f"/api/books/{book.id}").status_code == 200
    assert client_as(OTHER).get(f"/api/books/{book.id}").status_code == 404
    assert client_as(None).get(f"/api/books/{book.id}").status_code == 404


def test_published_books_are_public(store):
    book = draft_book(store)
    assert client_as(OWNER).post(f"/api/books/{book.id}/publish").status_code == 200
    assert client_as(None).get(f"/api/books/{book.id}").status_code == 200


def test_only_the_owner_can_publish(store):
    book = draft_book(store)
    assert client_as(OTHER).post(f"/api/books/{book.id}/publish").status_code == 404
    assert store.books[book.id].status == "draft"


def test_owner_can_delete_a_published_book(store):
    book = draft_book(store)
    client_as(OWNER).post(f"/api/books/{book.id}/publish")
    assert client_as(OTHER).delete(f"/api/books/{book.id}").status_code == 404
    assert client_as(None).delete(f"/api/books/{book.id}").status_code == 401
    assert book.id in store.books
    assert client_as(OWNER).delete(f"/api/books/{book.id}").status_code == 204
    assert client_as(None).get(f"/api/books/{book.id}").status_code == 404


def test_owner_edits_page_text_but_cannot_change_page_count(store):
    book = draft_book(store)
    ok = client_as(OWNER).put(
        f"/api/books/{book.id}",
        json={
            "titles": ["పింకీ మామిడి"],
            "pages": [[{"number": 1, "text": "కొత్త."}, {"number": 2, "text": "సరే."}]],
        },
    )
    assert ok.status_code == 200
    assert store.books[book.id].drafts[0].pages[0].text == "కొత్త."

    bad = client_as(OWNER).put(
        f"/api/books/{book.id}", json={"titles": ["x"], "pages": [[{"number": 1, "text": "only one"}]]}
    )
    assert bad.status_code == 422


def test_correction_fixes_the_book_and_is_saved_for_future_books(store):
    book = draft_book(store)
    response = client_as(OWNER).post(
        "/api/corrections",
        json={
            "book_id": book.id,
            "language": "te",
            "wrong": "వచ్చాడు",
            "right_text": "వచ్చింది",
            "note": "Pinky is a girl",
        },
    )

    assert response.status_code == 200
    assert store.books[book.id].drafts[0].pages[0].text == "పింకీ వచ్చింది."
    saved = store.corrections[("te", "వచ్చాడు")]
    assert saved.right_text == "వచ్చింది"


def test_correction_must_match_text_in_the_book(store):
    book = draft_book(store)
    response = client_as(OWNER).post(
        "/api/corrections", json={"book_id": book.id, "language": "te", "wrong": "లేదు", "right_text": "ఉంది"}
    )
    assert response.status_code == 422


def test_shared_links_preview_published_books_only(store):
    book = draft_book(store)
    client = client_as(None)

    assert "పింకీ మామిడి" not in client.get(f"/api/share/{book.id}").text  # drafts stay private
    book.status = "published"
    page = client.get(f"/api/share/{book.id}").text
    assert 'property="og:title" content="పింకీ మామిడి · Mangoes"' in page
    assert "Telugu picture book for ages 3–5" in page
    assert f"url=https://mothertongue-books.vercel.app/books/{book.id}" in page


def test_anyone_can_ask_for_a_language(store):
    response = client_as(None).post("/api/language-requests", json={"language": "Konkani", "can_help": True})
    assert response.status_code == 204
    assert store.language_requests[0].language == "Konkani" and store.language_requests[0].can_help


class FakeVoice:
    def __init__(self) -> None:
        self.said: list[tuple[str, str, float]] = []

    async def speak(self, language: str, text: str, rate: float, seed: int) -> dict:
        self.said.append((language, text, rate))
        return {"mp3": f"mp3 {seed}".encode(), "wav": text.encode()}


class FakeListener:
    """Hears each reading as the given transcripts, in turn, then as the clip's own text."""

    def __init__(self, *heard: str) -> None:
        self.heard = list(heard)

    async def hear(self, wav: bytes) -> str:
        return self.heard.pop(0) if self.heard else wav.decode()


@pytest.fixture
def voice(monkeypatch):
    v = FakeVoice()
    monkeypatch.setattr(main, "get_voice", lambda: v)
    monkeypatch.setattr(main, "get_listener", lambda: FakeListener())
    return v


def test_speech_reads_a_page_once_and_reuses_the_clip(store, voice):
    book = draft_book(store)
    body = {"book_id": book.id, "language": "te", "text": "పింకీ వచ్చాడు."}
    first = client_as(OWNER).post("/api/speech", json=body)
    assert first.status_code == 200
    assert first.json()["kind"] == "page"
    assert client_as(OWNER).post("/api/speech", json=body).json()["url"] == first.json()["url"]
    assert voice.said == [("te", "పింకీ వచ్చాడు.", speech.RATES["page"])]


def test_speech_only_reads_the_books_own_text_for_its_readers(store, voice):
    book = draft_book(store)
    other_text = {"book_id": book.id, "language": "te", "text": "anything else"}
    assert client_as(OWNER).post("/api/speech", json=other_text).status_code == 422
    page = {"book_id": book.id, "language": "te", "text": "పింకీ వచ్చాడు."}
    assert client_as(OTHER).post("/api/speech", json=page).status_code == 404  # someone else's draft
    assert client_as(OWNER).post("/api/speech", json=page | {"language": "zu"}).status_code == 404
    assert voice.said == []


def test_publishing_reads_the_whole_book_ahead(store, voice):
    book = draft_book(store)
    client_as(OWNER).post(f"/api/books/{book.id}/publish")
    # The title and both pages, each at the page pace.
    assert sorted(t for _, t, _ in voice.said) == sorted(["పింకీ మామిడి", "పింకీ వచ్చాడు.", "పింకీ నవ్వింది."])


def test_a_reading_the_listener_mishears_is_read_again():
    import asyncio

    v = FakeVoice()
    mp3 = asyncio.run(speech.best_reading(v, FakeListener("something else entirely"), "kn", "ಹಸು ಹುಲಿ", 0.8))
    assert mp3 == b"mp3 1"
    assert len(v.said) == 2


def test_the_closest_reading_is_kept_when_none_is_heard_right():
    import asyncio

    v = FakeVoice()
    listener = FakeListener("xx", "ಹಸು", "yy")
    assert asyncio.run(speech.best_reading(v, listener, "kn", "ಹಸು ಹುಲಿ", 0.8)) == b"mp3 1"
    assert len(v.said) == speech.READINGS


def test_a_clip_heard_in_a_neighbouring_script_still_matches():
    assert speech.match("ఇది సంక్రాంతి ఉదయం!", "ಇದು ಸಂಕ್ರಾಂತಿ ಉದಯಂ.") > 0.8  # Telugu heard as Kannada
    assert speech.match("कावळा पाणी", "કાવળા પાણી") == 1.0  # Marathi heard as Gujarati
    assert speech.match("ಹಸು", "something else") == 0.0


def test_tap_words_are_read_once_without_the_listener(store, voice, monkeypatch):
    monkeypatch.setattr(main, "get_listener", lambda: FakeListener("wrong", "wrong", "wrong"))
    book = draft_book(store)
    book.words = {1: [TapWord(english="mango", words={"te": "మామిడి"}, box=[0.1, 0.1, 0.5, 0.5])]}
    body = {"book_id": book.id, "language": "te", "text": "మామిడి"}
    assert client_as(OWNER).post("/api/speech", json=body).json()["kind"] == "word"
    assert len(voice.said) == 1

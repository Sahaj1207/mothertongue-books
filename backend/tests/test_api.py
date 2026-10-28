import pytest
from fastapi.testclient import TestClient

from app import main
from app.agents.schemas import BookRequest, StoryDraft, StoryPage, StoryPlan
from app.auth import User, optional_user, require_user
from app.models import Book
from app.store import MemoryStore

OWNER = User(id="owner-1", email="parent@example.com")
OTHER = User(id="other-2", email="someone@example.com")


@pytest.fixture
def store(monkeypatch):
    s = MemoryStore()
    monkeypatch.setattr(main, "store", s)
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

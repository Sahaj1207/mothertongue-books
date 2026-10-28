import asyncio

import pytest
from fastapi.testclient import TestClient

from app import main
from app.auth import User, require_user
from app.store import MemoryStore
from app.usage import UsageEntry

BOOK = {"language": "te", "level": 1, "topic": "sharing mangoes"}


@pytest.fixture(autouse=True)
def signed_in():
    main.app.dependency_overrides[require_user] = lambda: User(id="u1", email=None)
    yield
    main.app.dependency_overrides.clear()


def test_new_books_are_refused_once_the_daily_budget_is_spent(monkeypatch):
    store = MemoryStore()
    asyncio.run(store.save_usage("job", [UsageEntry("baseten", "muse-spark-1.3", "writer", 0, 600_000)]))
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(main.settings, "use_mock_ai", False)
    monkeypatch.setattr(main.settings, "daily_budget_usd", 2.0)

    response = TestClient(main.app).post("/api/books", json=BOOK)

    assert response.status_code == 429
    assert "budget" in response.json()["detail"]
    assert store.jobs == {}


def test_new_books_are_refused_once_a_provider_reaches_its_lifetime_cap(monkeypatch):
    store = MemoryStore()
    spent = UsageEntry("meta", "muse-spark-1.3", "writer", 0, 1_000_000)  # $4.25
    asyncio.run(store.save_usage(None, [spent]))
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(main.settings, "use_mock_ai", False)
    monkeypatch.setattr(main.settings, "story_provider", "meta")
    monkeypatch.setattr(main.settings, "daily_budget_usd", 100.0)
    monkeypatch.setattr(main.settings, "provider_budget_usd", {"meta": 4.0, "baseten": 80.0})

    response = TestClient(main.app).post("/api/books", json=BOOK)

    assert response.status_code == 429
    assert "credit budget" in response.json()["detail"]

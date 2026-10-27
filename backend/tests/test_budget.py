import asyncio

from fastapi.testclient import TestClient

from app import main
from app.store import MemoryStore
from app.usage import UsageEntry

BOOK = {"language": "te", "level": 1, "topic": "sharing mangoes"}


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

import asyncio
from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.agents import mock_responses
from app.config import settings

T = TypeVar("T", bound=BaseModel)


class ModelClient(Protocol):
    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        """Run one agent call and return output validated against `schema`."""
        ...


class MockModelClient:
    """Returns canned output per agent, with a short delay so progress looks real in the UI."""

    def __init__(self, delay: float | None = None):
        self.delay = settings.mock_step_delay if delay is None else delay

    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        await asyncio.sleep(self.delay)
        return schema.model_validate(mock_responses.respond(agent, prompt))


def get_client() -> ModelClient:
    if settings.use_mock_ai:
        return MockModelClient()
    # The Meta Model API client is added once API credits are active (Day 3).
    raise RuntimeError("Real model client not configured yet; set USE_MOCK_AI=true.")

import asyncio
import json
import re
from typing import Protocol, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.agents import mock_responses
from app.config import settings

T = TypeVar("T", bound=BaseModel)


class ModelError(Exception):
    """A model call finished but didn't return usable output."""


class ModelClient(Protocol):
    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        """Run one agent call and return output validated against `schema`."""
        ...

    def model_name(self, agent: str) -> str:
        """Human-readable name of the model that runs `agent`, shown in the UI."""
        ...


class MockModelClient:
    """Returns canned output per agent, with a short delay so progress looks real in the UI."""

    def __init__(self, delay: float | None = None):
        self.delay = settings.mock_step_delay if delay is None else delay

    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        await asyncio.sleep(self.delay)
        return schema.model_validate(mock_responses.respond(agent, prompt))

    def model_name(self, agent: str) -> str:
        return "Practice mode"


# Writing needs the most thought; checks and planning need less, which saves reasoning tokens.
META_EFFORT = {
    "topic_check": "low",
    "planner": "medium",
    "writer": "high",
    "reading_level": "low",
    "safety": "low",
}


class MetaModelClient:
    """Muse Spark on Meta Model API, with schema-constrained output (Standard mode only)."""

    def __init__(self, api_key: str, base_url: str, model: str):
        if model.endswith("-contributor"):
            raise ValueError("Contributor-mode models may train on content; use a Standard-mode model.")
        self.model = model
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, max_retries=3, timeout=180)

    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        response = await self.client.chat.completions.parse(
            model=self.model,
            messages=[{"role": "system", "content": instructions}, {"role": "user", "content": prompt}],
            response_format=schema,
            reasoning_effort=META_EFFORT.get(agent, "low"),
        )
        message = response.choices[0].message
        if message.parsed is None:
            raise ModelError(f"{agent}: no structured output ({message.refusal or 'empty response'}).")
        return message.parsed

    def model_name(self, agent: str) -> str:
        return "Muse Spark"


class OpenWeightClient:
    """Muse Spark Open, served by Baseten. The model always reasons; the answer arrives in `content`."""

    def __init__(self, api_key: str, base_url: str, model: str):
        self.model = model
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, max_retries=3, timeout=180)

    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": instructions + "\nReply with JSON only, matching the schema."},
                {"role": "user", "content": prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
            },
            reasoning_effort="low",
        )
        return parse_json_reply(response.choices[0].message.content or "", schema, agent)

    def model_name(self, agent: str) -> str:
        return "Muse Spark Open"


def parse_json_reply[M: BaseModel](text: str, schema: type[M], agent: str) -> M:
    """Validate a JSON reply, tolerating code fences or stray text around the object."""
    candidates = [text.strip()]
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.DOTALL)
    if fenced:
        candidates.append(fenced.group(1))
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            return schema.model_validate(json.loads(candidate))
        except (json.JSONDecodeError, ValidationError):
            continue
    raise ModelError(f"{agent}: reply wasn't valid {schema.__name__} JSON.")


class RoutedClient:
    """Sends each agent to its model: the safety reviewer to the open-weight model, the rest to Muse Spark."""

    def __init__(self, default: ModelClient, routes: dict[str, ModelClient]):
        self.default, self.routes = default, routes

    def _for(self, agent: str) -> ModelClient:
        return self.routes.get(agent, self.default)

    async def structured(self, *, agent: str, instructions: str, prompt: str, schema: type[T]) -> T:
        return await self._for(agent).structured(
            agent=agent, instructions=instructions, prompt=prompt, schema=schema
        )

    def model_name(self, agent: str) -> str:
        return self._for(agent).model_name(agent)


def get_client() -> ModelClient:
    if settings.use_mock_ai:
        return MockModelClient()
    if not settings.model_api_key:
        raise RuntimeError("MODEL_API_KEY is missing. Add it to backend/.env or set USE_MOCK_AI=true.")
    meta = MetaModelClient(settings.model_api_key, settings.meta_base_url, settings.story_model)
    routes: dict[str, ModelClient] = {}
    if settings.baseten_api_key:
        routes["safety"] = OpenWeightClient(
            settings.baseten_api_key, settings.baseten_base_url, settings.open_weight_model
        )
    return RoutedClient(meta, routes)

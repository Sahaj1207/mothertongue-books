import asyncio
import base64
import json
import re
from typing import Protocol, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.agents import mock_responses
from app.config import settings
from app.usage import record_usage

T = TypeVar("T", bound=BaseModel)

# An image passed to a vision-capable agent: raw bytes and their MIME type.
ImageInput = tuple[bytes, str]


class ModelError(Exception):
    """A model call finished but didn't return usable output."""


class ModelClient(Protocol):
    async def structured(
        self,
        *,
        agent: str,
        instructions: str,
        prompt: str,
        schema: type[T],
        images: list[ImageInput] | None = None,
    ) -> T:
        """Run one agent call (optionally with images) and return output validated against `schema`."""
        ...

    def model_name(self, agent: str) -> str:
        """Human-readable name of the model that runs `agent`, shown in the UI."""
        ...


class MockModelClient:
    """Returns canned output per agent, with a short delay so progress looks real in the UI."""

    def __init__(self, delay: float | None = None):
        self.delay = settings.mock_step_delay if delay is None else delay

    async def structured(
        self,
        *,
        agent: str,
        instructions: str,
        prompt: str,
        schema: type[T],
        images: list[ImageInput] | None = None,
    ) -> T:
        await asyncio.sleep(self.delay)
        return schema.model_validate(mock_responses.respond(agent, prompt))

    def model_name(self, agent: str) -> str:
        return "Practice mode"


# Writing needs the most thought; checks and planning need less, which saves reasoning tokens.
EFFORT = {
    "topic_check": "low",
    "folk_outline": "low",
    "planner": "medium",
    "writer": "high",
    "reading_level": "low",
    "safety": "low",
    "picture_check": "minimal",
    "object_finder": "minimal",
}

# Hard ceiling on tokens per call (reasoning included), so no single call can run up a large bill.
# The topic check can deliberate at length over a borderline folk tale before it decides.
MAX_TOKENS = {"planner": 8000, "writer": 12000, "topic_check": 8000}
DEFAULT_MAX_TOKENS = 4000


class MetaModelClient:
    """Muse Spark on Meta Model API, with schema-constrained output (Standard mode only)."""

    def __init__(self, api_key: str, base_url: str, model: str):
        if model.endswith("-contributor"):
            raise ValueError("Contributor-mode models may train on content; use a Standard-mode model.")
        self.model = model
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, max_retries=3, timeout=180)

    async def structured(
        self,
        *,
        agent: str,
        instructions: str,
        prompt: str,
        schema: type[T],
        images: list[ImageInput] | None = None,
    ) -> T:
        return await with_correction(self._once, agent, instructions, prompt, schema, images)

    async def _once(self, agent: str, messages: list[dict], schema: type[T]) -> T:
        try:
            response = await self.client.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=schema,
                reasoning_effort=EFFORT.get(agent, "low"),
                max_tokens=MAX_TOKENS.get(agent, DEFAULT_MAX_TOKENS),
            )
        except ValidationError as exc:
            raise ModelError(f"{agent}: {_first_error(exc)}") from exc
        record_usage("meta", self.model, agent, response.usage)
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

    async def structured(
        self,
        *,
        agent: str,
        instructions: str,
        prompt: str,
        schema: type[T],
        images: list[ImageInput] | None = None,
    ) -> T:
        # The model reasons before answering and doesn't see response_format while it plans, so without
        # the schema in the prompt it plans a different shape and the constrained answer comes out empty.
        schema_text = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        instructions += f"\nReply with JSON only, exactly matching this JSON Schema:\n{schema_text}"
        return await with_correction(self._once, agent, instructions, prompt, schema)

    async def _once(self, agent: str, messages: list[dict], schema: type[T]) -> T:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
            },
            reasoning_effort=EFFORT.get(agent, "low"),
            max_tokens=MAX_TOKENS.get(agent, DEFAULT_MAX_TOKENS),
        )
        record_usage("baseten", self.model, agent, response.usage)
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
    problem = f"reply wasn't valid {schema.__name__} JSON"
    for candidate in candidates:
        try:
            return schema.model_validate(json.loads(candidate))
        except json.JSONDecodeError:
            continue
        except ValidationError as exc:
            problem = _first_error(exc)
    raise ModelError(f"{agent}: {problem}")


def _first_error(exc: ValidationError) -> str:
    return exc.errors()[0]["msg"]


def user_content(prompt: str, images: list[ImageInput] | None) -> str | list[dict]:
    if not images:
        return prompt
    parts: list[dict] = [{"type": "text", "text": prompt}]
    for data, mime in images:
        url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
        parts.append({"type": "image_url", "image_url": {"url": url}})
    return parts


async def with_correction[M: BaseModel](
    once, agent: str, instructions: str, prompt: str, schema: type[M], images: list[ImageInput] | None = None
) -> M:
    """One call, plus one retry that tells the model what was wrong with its first reply."""
    messages = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": user_content(prompt, images)},
    ]
    try:
        return await once(agent, messages, schema)
    except ModelError as exc:
        fix = f"Your last reply was rejected: {exc}. Reply again, following the schema and its rules exactly."
        return await once(agent, [*messages, {"role": "user", "content": fix}], schema)


class RoutedClient:
    """Sends each agent to its model: the safety reviewer to the open-weight model, the rest to Muse Spark."""

    def __init__(self, default: ModelClient, routes: dict[str, ModelClient]):
        self.default, self.routes = default, routes

    def _for(self, agent: str) -> ModelClient:
        return self.routes.get(agent, self.default)

    async def structured(
        self,
        *,
        agent: str,
        instructions: str,
        prompt: str,
        schema: type[T],
        images: list[ImageInput] | None = None,
    ) -> T:
        return await self._for(agent).structured(
            agent=agent, instructions=instructions, prompt=prompt, schema=schema, images=images
        )

    def model_name(self, agent: str) -> str:
        return self._for(agent).model_name(agent)


def get_client() -> ModelClient:
    if settings.use_mock_ai:
        return MockModelClient()

    open_weight = None
    if settings.baseten_api_key:
        open_weight = OpenWeightClient(
            settings.baseten_api_key, settings.baseten_base_url, settings.open_weight_model
        )

    if settings.story_provider == "open-weight":
        if open_weight is None:
            raise RuntimeError("STORY_PROVIDER=open-weight needs BASETEN_API_KEY in backend/.env.")
        return open_weight

    if not settings.model_api_key:
        raise RuntimeError("MODEL_API_KEY is missing. Add it to backend/.env or set USE_MOCK_AI=true.")
    meta = MetaModelClient(settings.model_api_key, settings.meta_base_url, settings.story_model)
    return RoutedClient(meta, {"safety": open_weight} if open_weight else {})

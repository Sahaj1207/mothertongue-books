import asyncio

import pytest

from app.agents.client import MockModelClient, ModelError, RoutedClient, parse_json_reply
from app.agents.schemas import Review


def test_parses_plain_json():
    review = parse_json_reply('{"passed": true, "problems": []}', Review, "safety")
    assert review.passed


def test_parses_json_inside_code_fence_and_chatter():
    text = 'Here is my review:\n```json\n{"passed": false, "problems": ["Page 3: scary"]}\n```\nThanks!'
    review = parse_json_reply(text, Review, "safety")
    assert review.problems == ["Page 3: scary"]


def test_rejects_reply_that_does_not_match_schema():
    with pytest.raises(ModelError):
        parse_json_reply('{"verdict": "fine"}', Review, "safety")


class Named(MockModelClient):
    def __init__(self, name: str):
        super().__init__(delay=0)
        self.name, self.agents = name, []

    async def structured(self, *, agent, instructions, prompt, schema):
        self.agents.append(agent)
        return await super().structured(agent=agent, instructions=instructions, prompt=prompt, schema=schema)

    def model_name(self, agent: str) -> str:
        return self.name


def test_router_sends_safety_to_the_open_weight_model():
    spark, open_model = Named("Muse Spark"), Named("Muse Spark Open")
    client = RoutedClient(spark, {"safety": open_model})

    asyncio.run(client.structured(agent="safety", instructions="", prompt="", schema=Review))
    asyncio.run(client.structured(agent="reading_level", instructions="", prompt="", schema=Review))

    assert open_model.agents == ["safety"]
    assert spark.agents == ["reading_level"]
    assert client.model_name("safety") == "Muse Spark Open"
    assert client.model_name("writer") == "Muse Spark"


def test_contributor_models_are_refused():
    from app.agents.client import MetaModelClient

    with pytest.raises(ValueError):
        MetaModelClient("key", "https://api.meta.ai/v1", "muse-spark-1.3-contributor")

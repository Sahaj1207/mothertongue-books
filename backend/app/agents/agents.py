"""The story agents. Each one is a single structured model call with its own instructions."""

from app.agents.client import ImageInput, ModelClient
from app.agents.schemas import BookRequest, PictureCheck, Review, StoryDraft, StoryPlan, TopicCheck
from app.models import Correction

LANGUAGE_NAMES = {"te": "Telugu", "kn": "Kannada", "mr": "Marathi", "en": "English"}

LEVEL_GUIDE = {
    1: "Ages 3-5. One short sentence per page, 3-6 common words, lots of repetition.",
    2: "Ages 5-7. One or two short sentences per page, everyday words, simple past tense.",
    3: "Ages 7-9. Two or three sentences per page, a little dialogue, simple connecting words.",
}

CHILD_SAFE_RULES = """Child-safety rules for every story:
- Age-appropriate language only. No frightening, violent, cruel or adult content.
- No stereotypes about any religion, caste, gender, region, community or disability.
- No real public figures, brands or political content.
- Conflict is gentle and always resolved kindly."""


async def check_topic(client: ModelClient, request: BookRequest) -> TopicCheck:
    return await client.structured(
        agent="topic_check",
        instructions=(
            "You screen story requests for a children's picture-book app. Allow ordinary childhood topics. "
            "Block anything violent, sexual, hateful, frightening, political or about self-harm.\n"
            + CHILD_SAFE_RULES
        ),
        prompt=f"Topic: {request.topic}\nReading level: {request.level}",
        schema=TopicCheck,
    )


async def plan_story(client: ModelClient, request: BookRequest) -> StoryPlan:
    return await client.structured(
        agent="planner",
        instructions=(
            "You plan short picture books for Indian children. Write the plan in English; it will be written "
            "natively into each language later, so use characters, food, places and festivals that fit the "
            "child's region. Plan 6-8 pages, one clear event per page, and a scene description for the picture.\n"
            + CHILD_SAFE_RULES
        ),
        prompt=(
            f"Topic: {request.topic}\n"
            f"Story language: {LANGUAGE_NAMES[request.language]}\n"
            f"Reading level: {LEVEL_GUIDE[request.level]}"
        ),
        schema=StoryPlan,
    )


async def write_story(
    client: ModelClient,
    plan: StoryPlan,
    language: str,
    level: int,
    feedback: list[str] | None = None,
    corrections: list[Correction] | None = None,
) -> StoryDraft:
    fix_note = ""
    if corrections:
        fixes = [f"{c.wrong} -> {c.right_text}" + (f" ({c.note})" if c.note else "") for c in corrections]
        fix_note += "\nNative speakers corrected these before. Never use the wrong form:\n- " + "\n- ".join(
            fixes
        )
    if feedback:
        fix_note += (
            "\nA reviewer found these problems in your last draft. Fix all of them:\n- "
            + "\n- ".join(feedback)
        )
    return await client.structured(
        agent="writer",
        instructions=(
            f"You are a children's author who writes natively in {LANGUAGE_NAMES[language]}. Write the story "
            "directly in the language from the plan. Do not translate word by word from English: use natural "
            "phrasing, rhythm and repetition a native parent would use when reading aloud. Use the script of the "
            "language only. One page of text per planned page.\n" + CHILD_SAFE_RULES
        ),
        prompt=(
            f"Language code: {language}\n"
            f"Reading level: {LEVEL_GUIDE[level]}\n"
            f"Plan:\n{plan.model_dump_json(indent=2)}{fix_note}"
        ),
        schema=StoryDraft,
    )


async def check_reading_level(client: ModelClient, draft: StoryDraft, level: int) -> Review:
    return await client.structured(
        agent="reading_level",
        instructions=(
            f"You are an early-reading teacher fluent in {LANGUAGE_NAMES[draft.language]}, checking a picture "
            "book that a parent reads aloud with the child. Judge each word by whether a child of this age hears "
            "it at home, not by its length: Indian-language words are naturally long because they join parts "
            "together, and that is fine. Also check the number of sentences per page and grammar such as gender "
            "and number agreement. Report only real problems a parent would notice, each with its page number "
            "and a concrete fix. Minor style preferences are not problems. Pass if no page has a real problem."
        ),
        prompt=f"Reading level: {LEVEL_GUIDE[level]}\nStory:\n{draft.model_dump_json(indent=2)}",
        schema=Review,
    )


async def review_safety(client: ModelClient, draft: StoryDraft) -> Review:
    return await client.structured(
        agent="safety",
        instructions=(
            "You are the final safety reviewer for a children's book. Check the story against the rules below. "
            "List each problem with its page number. Pass only if there are no problems.\n" + CHILD_SAFE_RULES
        ),
        prompt=f"Story ({LANGUAGE_NAMES[draft.language]}):\n{draft.model_dump_json(indent=2)}",
        schema=Review,
    )


async def check_picture(client: ModelClient, image: ImageInput, scene: str, looks: list[str]) -> PictureCheck:
    """Looks at one finished illustration before any person sees it."""
    return await client.structured(
        agent="picture_check",
        instructions=(
            "You check illustrations for a children's picture book. Ask one question: would a parent reject "
            "this page? Report only serious problems: broken or impossible bodies (a detached or floating "
            "head, extra or missing limbs, people merged together), a face that looks frightening or monstrous, "
            "any text or letters, anything unsafe or not child-friendly, or the scene's main action missing "
            "entirely. Do NOT report small differences from the descriptions (hair, number of braids, jewellery, "
            "beards, clothing details), hand poses, mild expressions, background objects, kite strings or "
            "artistic choices. For each serious problem, say what is wrong and how to fix it."
        ),
        prompt=f"Scene: {scene}\nCharacters: {'; '.join(looks) or 'none named'}",
        schema=PictureCheck,
        images=[image],
    )

"""The story agents. Each one is a single structured model call with its own instructions."""

from app.agents.client import ImageInput, ModelClient
from app.agents.schemas import (
    BookRequest,
    FolkOutline,
    FoundObjects,
    PictureCheck,
    Review,
    StoryDraft,
    StoryPlan,
    TopicCheck,
)
from app.languages import LANGUAGE_NAMES, LANGUAGES
from app.models import Correction

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
        prompt=f"Topic: {request.topic}\nReading level: {request.level}"
        + (f"\nRetold folk tale. Outline:\n{request.outline}" if request.outline else ""),
        schema=TopicCheck,
    )


async def outline_folk_tale(client: ModelClient, tale: str, language: str) -> FolkOutline:
    """The plot of a traditional tale, softened for young children; an adult edits it before writing."""
    return await client.structured(
        agent="folk_outline",
        instructions=(
            f"You know the world's traditional tales, especially {LANGUAGES[language].traditions}, as told "
            f"to children in {LANGUAGES[language].region}. Give the plot of the tale the adult names, as it is traditionally told, in 6-8 short steps. Keep its characters, "
            "setting and ending. Soften anything too frightening for ages 3-9 (no killing, eating or cruelty "
            "shown; a trick or a lucky escape instead) and say what you softened. If you don't know the tale "
            "or it isn't traditional, set known to false and don't invent one."
        ),
        prompt=f"Tale: {tale}\nIt will be retold in {LANGUAGE_NAMES[language]}.",
        schema=FolkOutline,
    )


async def plan_story(client: ModelClient, request: BookRequest) -> StoryPlan:
    return await client.structured(
        agent="planner",
        instructions=(
            f"You plan short picture books for children who speak {LANGUAGE_NAMES[request.language]} in "
            f"{LANGUAGES[request.language].region}. Write the plan in English; it will be written natively into "
            "each language later, so use characters, food, places and festivals that fit where they live, and say "
            "where it is in the setting. Plan 6-8 pages, one clear event per page, and a scene description for the picture.\n"
            + CHILD_SAFE_RULES
        ),
        prompt=(
            f"Topic: {request.topic}\n"
            f"Story language: {LANGUAGE_NAMES[request.language]}\n"
            f"Reading level: {LEVEL_GUIDE[request.level]}"
            + (
                f"\nThis is a retelling of a traditional tale ({request.source or LANGUAGE_NAMES[request.language] + ' folk tale'}). "
                "Follow this outline closely, keeping its characters and ending, one step per page:\n"
                f"{request.outline}"
                if request.kind == "folk-tale"
                else ""
            )
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
            "it at home, not by its length: in many languages words are naturally long because they join parts "
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
            "text a reader would notice (words or names written over the picture, labels, captions, signatures, "
            "or large lettering), anything unsafe or not child-friendly, or the scene's main action missing "
            "entirely. Do NOT report small differences from the descriptions (hair, number of braids, jewellery, "
            "beards, clothing details), hand poses, mild expressions, background objects, small marks or "
            "scribbles on background vehicles and shop signs, kite strings or artistic choices. For each "
            "serious problem, say what is wrong and how to fix it."
        ),
        prompt=f"Scene: {scene}\nCharacters: {'; '.join(looks) or 'none named'}",
        schema=PictureCheck,
        images=[image],
    )


async def find_objects(
    client: ModelClient, image: ImageInput, page_texts: dict[str, str], languages: list[str]
) -> FoundObjects:
    """Picks objects in a picture worth tapping, with their words in each language of the book."""
    names = ", ".join(f"{LANGUAGE_NAMES[code]} ({code})" for code in languages)
    text = "\n".join(f"{LANGUAGE_NAMES[code]}: {t}" for code, t in page_texts.items())
    return await client.structured(
        agent="object_finder",
        instructions=(
            "You choose words for a tap-to-learn picture book. Look at the picture and pick up to 4 objects a "
            "young child could point at and name: clearly visible, large enough to tap, and concrete (a kite, "
            "an umbrella, a bus, a mango, a dog). Prefer objects mentioned in the page text, and skip people's "
            "names, tiny background details and abstract things. For each object give a short English noun "
            f"phrase that names it as drawn (for a segmentation model) and the everyday word in: {names}. "
            "Use the word a parent would say at home, in the language's own script, singular."
        ),
        prompt=f"Page text:\n{text}",
        schema=FoundObjects,
        images=[image],
    )

"""Canned agent output for mock mode. Shapes match app.agents.schemas exactly."""

import re

BLOCKED_WORDS = ("blood", "gun", "kill", "weapon", "horror", "violence")

SAMPLE_SENTENCE = {
    "te": "ఇది ఒక నమూనా కథ.",
    "kn": "ಇದು ಒಂದು ಮಾದರಿ ಕಥೆ.",
    "mr": "ही एक नमुना गोष्ट आहे.",
    "en": "This is a sample story.",
}

SAMPLE_TITLE = {
    "te": "నమూనా పుస్తకం",
    "kn": "ಮಾದರಿ ಪುಸ್ತಕ",
    "mr": "नमुना पुस्तक",
    "en": "Sample book",
}

PAGE_COUNT = 6


def _field(prompt: str, name: str) -> str:
    match = re.search(rf"^{name}:\s*(.+)$", prompt, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def respond(agent: str, prompt: str) -> dict:
    if agent == "topic_check":
        topic = _field(prompt, "Topic").lower()
        blocked = next((w for w in BLOCKED_WORDS if w in topic), None)
        if blocked:
            return {"allowed": False, "reason": "This topic isn't suitable for young children."}
        return {"allowed": True, "reason": "Suitable for children."}

    if agent == "planner":
        topic = _field(prompt, "Topic") or "a day in the village"
        return {
            "title_en": f"A story about {topic}",
            "setting": "A small village with a mango tree near the school.",
            "lesson": "Sharing makes everyone happier.",
            "characters": [
                {
                    "name": "Anu",
                    "description": "A curious six-year-old girl.",
                    "look": "Six-year-old girl with two braids, yellow skirt and red bangles.",
                },
                {
                    "name": "Ajji",
                    "description": "Anu's grandmother, who tells stories.",
                    "look": "Grandmother with grey hair in a bun and a green cotton saree.",
                },
            ],
            "pages": [
                {
                    "number": n,
                    "event": f"Event {n} of the story.",
                    "scene": f"Picture {n}: Anu under the mango tree.",
                }
                for n in range(1, PAGE_COUNT + 1)
            ],
        }

    if agent == "writer":
        language = _field(prompt, "Language code") or "te"
        sentence = SAMPLE_SENTENCE.get(language, SAMPLE_SENTENCE["en"])
        return {
            "language": language,
            "title": SAMPLE_TITLE.get(language, SAMPLE_TITLE["en"]),
            "pages": [{"number": n, "text": f"{sentence} ({n})"} for n in range(1, PAGE_COUNT + 1)],
        }

    if agent == "object_finder":
        return {"objects": []}

    if agent == "picture_check":
        return {"problems": [], "usable": True}

    if agent in ("reading_level", "safety"):
        return {"passed": True, "problems": []}

    raise ValueError(f"No mock response for agent {agent!r}")

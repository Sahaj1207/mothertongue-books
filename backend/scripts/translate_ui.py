"""Drafts the website's Telugu, Kannada and Marathi text with Muse Spark, for native speakers to check.

Only phrases a language doesn't have yet are sent, so re-running after adding English phrases keeps every
reviewed translation as it is.

Run from backend/:  uv run python -m scripts.translate_ui [te kn mr]
"""

import ast
import asyncio
import json
import re
import sys
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings
from app.usage import UsageMeter, current_meter, record_usage

LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales"
NAMES = {"te": "Telugu", "kn": "Kannada", "mr": "Marathi"}
REGIONS = {"te": "Andhra Pradesh and Telangana", "kn": "Karnataka", "mr": "Maharashtra"}
CHUNK = 70

INSTRUCTIONS = """You translate the interface of a children's picture-book website for parents and teachers in {region}.
Write {name} the way a parent there talks: simple, warm, everyday words, not formal or bookish ones.
Common English words people say in {name} (PDF, email, password) may stay as they are, in {name} script
where people write them that way. Rules:
- Keep every {{placeholder}} exactly as written, untranslated.
- Keep the names MotherTongue Books, Muse Spark and FLUX in English letters.
- Language names go in {name} script (for example the {name} word for Kannada).
- Folk-tale titles use the name the tale is known by in {name}.
- In print.howTo keep “Save as PDF” in English, since that is what the browser's print window shows.
- Keep line breaks (\\n) where the English has them.
Reply with one JSON object mapping each key to its {name} text, and nothing else."""


def english() -> dict[str, str]:
    """The phrases in en.ts, which is a plain object literal: drop the comments and read it as Python."""
    text = (LOCALES / "en.ts").read_text(encoding="utf-8")
    body = text[text.index("= {") + 2 : text.rindex("} as const") + 1]
    body = "\n".join(line for line in body.splitlines() if not line.strip().startswith("//"))
    return ast.literal_eval(body)


def existing(lang: str) -> dict[str, str]:
    path = LOCALES / f"{lang}.ts"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    body = text[text.index("= {") + 2 : text.rindex("}") + 1]
    return json.loads(body)


def write(lang: str, messages: dict[str, str], order: list[str]) -> None:
    ordered = {k: messages[k] for k in order if k in messages}
    body = json.dumps(ordered, ensure_ascii=False, indent=2)
    (LOCALES / f"{lang}.ts").write_text(
        f"// {NAMES[lang]} website text. Drafted by Muse Spark (backend/scripts/translate_ui.py); "
        "correct anything that doesn't sound right.\n"
        "import type { MessageKey } from './en'\n\n"
        f"export const {lang}: Partial<Record<MessageKey, string>> = {body}\n",
        encoding="utf-8",
        newline="\n",
    )


async def translate(client: AsyncOpenAI, lang: str, phrases: dict[str, str]) -> dict[str, str]:
    response = await client.chat.completions.create(
        model=settings.story_model,
        messages=[
            {"role": "system", "content": INSTRUCTIONS.format(name=NAMES[lang], region=REGIONS[lang])},
            {"role": "user", "content": json.dumps(phrases, ensure_ascii=False, indent=1)},
        ],
        reasoning_effort="low",
        max_tokens=16000,
    )
    record_usage("meta", settings.story_model, "ui_translator", response.usage)
    text = response.choices[0].message.content or ""
    reply = json.loads(text[text.index("{") : text.rindex("}") + 1])
    missing_placeholders = [
        k for k, v in reply.items() if k in phrases and sorted(_holes(v)) != sorted(_holes(phrases[k]))
    ]
    for key in missing_placeholders:
        print(f"  {lang} {key}: placeholders changed, keeping English")
        reply.pop(key)
    return {k: v for k, v in reply.items() if k in phrases and isinstance(v, str) and v.strip()}


def _holes(text: str) -> list[str]:
    return re.findall(r"\{\w+\}", text)


async def main(langs: list[str]) -> None:
    source = english()
    client = AsyncOpenAI(api_key=settings.model_api_key, base_url=settings.meta_base_url, timeout=300)
    meter = UsageMeter()
    current_meter.set(meter)
    for lang in langs:
        done = existing(lang)
        todo = {k: v for k, v in source.items() if k not in done}
        chunks = [dict(list(todo.items())[i : i + CHUNK]) for i in range(0, len(todo), CHUNK)]
        results = await asyncio.gather(*(translate(client, lang, c) for c in chunks))
        for r in results:
            done.update(r)
        write(lang, done, list(source))
        print(f"{NAMES[lang]}: {len(done)} of {len(source)} phrases")
    print(f"Cost ${meter.cost_usd:.4f}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["te", "kn", "mr"]))

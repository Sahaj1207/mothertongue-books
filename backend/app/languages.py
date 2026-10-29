"""Every language a book can be written in. Adding a language starts here and in frontend/src/lib/languages.ts
(a test checks the two lists match); see "Adding a language" in the README."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Language:
    code: str
    name: str
    # Where its children live: the planner sets stories here and the pictures follow.
    region: str
    # Folk-tale traditions the outline helper should know for this language.
    traditions: str
    # False until native speakers have checked books in it; the website marks it "New".
    reviewed: bool


LANGUAGES: dict[str, Language] = {
    lang.code: lang
    for lang in [
        Language(
            "te",
            "Telugu",
            "Andhra Pradesh and Telangana, India",
            "Panchatantra, Jataka, Tenali Rama and Telugu folk tales",
            reviewed=True,
        ),
        Language(
            "kn",
            "Kannada",
            "Karnataka, India",
            "Panchatantra, Jataka and Kannada folk tales and folk songs",
            reviewed=True,
        ),
        Language(
            "mr",
            "Marathi",
            "Maharashtra, India",
            "Panchatantra, Jataka, Birbal and Marathi folk tales",
            reviewed=True,
        ),
        Language(
            "sw",
            "Swahili",
            "Kenya and Tanzania, East Africa",
            "Swahili and East African folk tales, such as the Abunuwasi stories",
            reviewed=False,
        ),
        Language("ne", "Nepali", "Nepal", "Nepali folk tales and Panchatantra", reviewed=False),
        Language(
            "zu",
            "isiZulu",
            "KwaZulu-Natal and Gauteng, South Africa",
            "isiZulu and Southern African folk tales, such as the uChakijana stories",
            reviewed=False,
        ),
        Language(
            "ht",
            "Haitian Creole",
            "Haiti",
            "Haitian folk tales, such as the Bouki and Ti Malice stories",
            reviewed=False,
        ),
        Language(
            "eu",
            "Basque",
            "the Basque Country, in Spain and France",
            "Basque folk tales and legends, such as those of Olentzero",
            reviewed=False,
        ),
    ]
}

# English is only ever the second language of a two-language book.
PAIR_ONLY = {"en": "English"}

LANGUAGE_NAMES = {code: lang.name for code, lang in LANGUAGES.items()} | PAIR_ONLY

# Pydantic validates against these; built from the list above so a new language needs no other change.
BookLanguage = Literal[tuple(LANGUAGES)]  # type: ignore[valid-type]
AnyLanguage = Literal[tuple(LANGUAGE_NAMES)]  # type: ignore[valid-type]

from typing import Literal

from pydantic import BaseModel, Field, model_validator

LanguageCode = Literal["te", "kn", "mr", "en"]
BookKind = Literal["original", "two-language", "folk-tale"]


class BookRequest(BaseModel):
    language: Literal["te", "kn", "mr"]
    pair_language: LanguageCode | None = None
    level: Literal[1, 2, 3]
    kind: BookKind = "original"
    topic: str = Field(min_length=3, max_length=200)

    @model_validator(mode="after")
    def check_pair(self) -> "BookRequest":
        if self.kind == "two-language" and (
            self.pair_language is None or self.pair_language == self.language
        ):
            raise ValueError("Two-language books need a second, different language.")
        if self.kind != "two-language" and self.pair_language is not None:
            raise ValueError("Only two-language books take a second language.")
        return self


class TopicCheck(BaseModel):
    allowed: bool
    reason: str = Field(description="Short reason, shown to the adult if the topic is blocked.")


class Character(BaseModel):
    name: str
    description: str


class PagePlan(BaseModel):
    number: int
    event: str = Field(description="What happens on this page, in English.")
    scene: str = Field(description="What the picture shows, in English.")


class StoryPlan(BaseModel):
    """Language-neutral plan. Every language version is written from the same plan."""

    title_en: str
    setting: str
    lesson: str
    characters: list[Character]
    pages: list[PagePlan]


class StoryPage(BaseModel):
    number: int
    text: str


class StoryDraft(BaseModel):
    language: LanguageCode
    title: str
    pages: list[StoryPage]


class Review(BaseModel):
    passed: bool
    problems: list[str] = Field(
        default_factory=list, description="Specific, fixable problems. Empty when passed."
    )

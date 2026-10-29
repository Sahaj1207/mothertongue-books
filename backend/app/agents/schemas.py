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


# Reason fields come before verdicts so the model explains itself before deciding.
class TopicCheck(BaseModel):
    reason: str = Field(description="Short reason, shown to the adult if the topic is blocked.")
    allowed: bool


class Character(BaseModel):
    name: str
    description: str
    look: str = Field(
        description="Fixed appearance for every picture: age, hair, clothes and colours, in one sentence.",
    )


class PagePlan(BaseModel):
    number: int
    event: str = Field(description="What happens on this page, in English.")
    scene: str = Field(
        description="What the picture shows, in English. Name the characters in it; describe the setting."
    )


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
    problems: list[str] = Field(
        description="Every specific, fixable problem, each starting with its page number. Empty only if none."
    )
    passed: bool = Field(description="True only when the problems list is empty.")

    @model_validator(mode="after")
    def verdict_matches_problems(self) -> "Review":
        # A failure without reasons gives the writer nothing to fix.
        if not self.passed and not self.problems:
            raise ValueError("A failed review must list its problems.")
        if self.passed and self.problems:
            raise ValueError("A review that lists problems cannot pass.")
        return self


class PictureCheck(BaseModel):
    problems: list[str] = Field(
        description="Each visible flaw that a parent would notice, with what to change. Empty only if none."
    )
    usable: bool = Field(description="True only when the problems list is empty.")

    @model_validator(mode="after")
    def verdict_matches_problems(self) -> "PictureCheck":
        if not self.usable and not self.problems:
            raise ValueError("An unusable picture must list its problems.")
        if self.usable and self.problems:
            raise ValueError("A picture with problems cannot be usable.")
        return self

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.agents.schemas import BookRequest, StoryDraft, StoryPlan
from app.languages import AnyLanguage

StepStatus = Literal["waiting", "running", "done", "failed"]


class Step(BaseModel):
    key: str
    label: str
    status: StepStatus = "waiting"
    detail: str | None = None
    model: str | None = None


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: Literal["running", "done", "blocked", "failed"] = "running"
    request: BookRequest
    steps: list[Step] = Field(default_factory=list)
    book_id: str | None = None
    message: str | None = None
    cost_usd: float = 0.0
    owner_id: str | None = None

    def step(self, key: str) -> Step:
        return next(s for s in self.steps if s.key == key)


class TapWord(BaseModel):
    """An object a child can tap in a page's picture, with its word in each language of the book."""

    english: str
    words: dict[str, str]
    # Where it is in the picture, as fractions of width and height: x1, y1, x2, y2.
    box: tuple[float, float, float, float]


class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    request: BookRequest
    plan: StoryPlan
    drafts: list[StoryDraft]
    # Reading-level notes the checker still had after the writer's retries, for the adult reviewer.
    review_notes: list[str] = Field(default_factory=list)
    # Public picture URL for each page that has one; pages are shared by every language version.
    images: dict[int, str] = Field(default_factory=dict)
    # Tap-to-learn objects per page number.
    words: dict[int, list[TapWord]] = Field(default_factory=dict)
    status: Literal["draft", "published"] = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    published_at: datetime | None = None
    owner_id: str | None = None


class LanguageRequest(BaseModel):
    """Someone asking for books in a language we don't offer yet; no personal details."""

    language: str = Field(min_length=2, max_length=60)
    can_help: bool = False
    note: str | None = Field(default=None, max_length=300)


class Correction(BaseModel):
    """A native speaker's fix, applied to the book and reused by the writer in later books."""

    language: AnyLanguage
    wrong: str = Field(min_length=1, max_length=120)
    right_text: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=300)

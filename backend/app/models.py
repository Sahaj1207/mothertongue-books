from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.agents.schemas import BookRequest, StoryDraft, StoryPlan

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

    def step(self, key: str) -> Step:
        return next(s for s in self.steps if s.key == key)


class Book(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    request: BookRequest
    plan: StoryPlan
    drafts: list[StoryDraft]
    # Reading-level notes the checker still had after the writer's retries, for the adult reviewer.
    review_notes: list[str] = Field(default_factory=list)
    status: Literal["draft", "published"] = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    published_at: datetime | None = None

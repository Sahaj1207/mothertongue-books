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


class Job(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    status: Literal["running", "done", "blocked", "failed"] = "running"
    request: BookRequest
    steps: list[Step] = Field(default_factory=list)
    book_id: str | None = None
    message: str | None = None

    def step(self, key: str) -> Step:
        return next(s for s in self.steps if s.key == key)


class Book(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    request: BookRequest
    plan: StoryPlan
    drafts: list[StoryDraft]
    status: Literal["draft", "published"] = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

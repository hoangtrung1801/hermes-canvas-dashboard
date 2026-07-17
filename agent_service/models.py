from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

RunStatus = Literal["running", "completed", "failed", "cancelled"]


class Conversation(BaseModel):
    id: str
    canvas_id: str
    title: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RunRecord(BaseModel):
    id: str
    conversation_id: str
    status: RunStatus
    error_code: str | None = None
    started_at: datetime
    finished_at: datetime | None = None


class StreamEvent(BaseModel):
    event: str
    data: dict[str, Any] = Field(default_factory=dict)


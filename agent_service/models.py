from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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


class CanvasModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CanvasCamera(CanvasModel):
    x: float
    y: float
    z: float


class CanvasViewport(CanvasModel):
    x: float
    y: float
    w: float
    h: float


class CanvasShape(CanvasModel):
    id: str
    type: str
    x: float
    y: float
    rotation: float = 0
    opacity: float = Field(default=1, ge=0, le=1)
    w: float | None = None
    h: float | None = None
    props: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class CanvasObservation(CanvasModel):
    canvas_id: str = Field(alias="canvasId")
    page_id: str = Field(alias="pageId")
    selected_shape_ids: list[str] = Field(alias="selectedShapeIds")
    camera: CanvasCamera
    viewport_page_bounds: CanvasViewport | None = Field(
        default=None, alias="viewportPageBounds"
    )
    shapes: list[CanvasShape]


class CanvasActionResult(CanvasModel):
    action_type: str = Field(alias="actionType")
    created_shape_ids: list[str] | None = Field(default=None, alias="createdShapeIds")
    updated_shape_ids: list[str] | None = Field(default=None, alias="updatedShapeIds")
    deleted_shape_ids: list[str] | None = Field(default=None, alias="deletedShapeIds")
    created_binding_ids: list[str] | None = Field(default=None, alias="createdBindingIds")
    deleted_binding_ids: list[str] | None = Field(default=None, alias="deletedBindingIds")
    error: str | None = None


class CanvasExecution(CanvasModel):
    results: list[CanvasActionResult]
    observation: CanvasObservation

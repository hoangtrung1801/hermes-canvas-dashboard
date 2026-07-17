import asyncio
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from agent_service.canvas_client import CanvasGatewayClient
from agent_service.canvas_context import arrange_positions, summarize_canvas
from agent_service.models import CanvasObservation, CanvasShape

TArgs = TypeVar("TArgs", bound="ToolArgs")
ToolHandler = Callable[[TArgs], Awaitable[str]]


class CanvasActionLimitExceeded(ToolException):
    """The turn used its safe canvas-action budget."""

TldrawColor = Literal[
    "black",
    "grey",
    "light-violet",
    "violet",
    "blue",
    "light-blue",
    "yellow",
    "orange",
    "green",
    "light-green",
    "light-red",
    "red",
    "white",
]
BuiltinShapeType = Literal[
    "arrow",
    "bookmark",
    "draw",
    "embed",
    "frame",
    "geo",
    "group",
    "highlight",
    "image",
    "line",
    "note",
    "text",
    "video",
]
ProjectStatus = Literal["todo", "doing", "done", "blocked"]


class ToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmptyArgs(ToolArgs):
    pass


class ShapeIdsArgs(ToolArgs):
    shape_ids: list[str] = Field(min_length=1)


class SetCameraArgs(ToolArgs):
    x: float
    y: float
    z: float | None = Field(default=None, gt=0)


class CreateBuiltinShapeArgs(ToolArgs):
    shape_type: BuiltinShapeType
    id: str | None = None
    x: float | None = None
    y: float | None = None
    rotation: float | None = None
    opacity: float | None = Field(default=None, ge=0, le=1)
    props: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class UpdateBuiltinShapeArgs(ToolArgs):
    shape_id: str
    x: float | None = None
    y: float | None = None
    rotation: float | None = None
    opacity: float | None = Field(default=None, ge=0, le=1)
    props: dict[str, Any] | None = None
    meta: dict[str, Any] | None = None

    @model_validator(mode="after")
    def require_patch(self):
        if not any(
            value is not None
            for value in (self.x, self.y, self.rotation, self.opacity, self.props, self.meta)
        ):
            raise ValueError("At least one update field is required")
        return self


class MoveShapesArgs(ShapeIdsArgs):
    x: float | None = None
    y: float | None = None
    dx: float | None = None
    dy: float | None = None

    @model_validator(mode="after")
    def require_position(self):
        if all(value is None for value in (self.x, self.y, self.dx, self.dy)):
            raise ValueError("x, y, dx, or dy is required")
        return self


class TodoTaskInput(ToolArgs):
    id: str | None = None
    text: str = Field(min_length=1)
    done: bool = False


class CreateTodoBlockArgs(ToolArgs):
    title: str = Field(min_length=1)
    x: float
    y: float
    id: str | None = None
    tasks: list[TodoTaskInput] = Field(default_factory=list)
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)
    background_color: str | None = None


class AppendTodoTaskArgs(ToolArgs):
    shape_id: str
    text: str = Field(min_length=1)
    task_id: str | None = None


class TodoTaskTargetArgs(ToolArgs):
    shape_id: str
    task_id: str


class SetTodoTaskDoneArgs(TodoTaskTargetArgs):
    done: bool


class CreateLinkCardArgs(ToolArgs):
    title: str = Field(min_length=1)
    url: str
    x: float
    y: float
    id: str | None = None
    description: str | None = None
    image_url: str | None = None
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)
    background_color: str | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("url must use HTTP or HTTPS")
        return value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value and not value.startswith(("http://", "https://", "data:image/")):
            raise ValueError("image_url must be HTTP(S) or an image data URI")
        return value


class CreateNoteCardArgs(ToolArgs):
    title: str = Field(min_length=1)
    tag: str = Field(min_length=1)
    x: float
    y: float
    id: str | None = None
    content: str | None = None
    color: TldrawColor | None = None
    size: Literal["s", "m", "l", "xl"] | None = None


class CreateDocsCardArgs(ToolArgs):
    title: str = Field(min_length=1)
    x: float
    y: float
    id: str | None = None
    content: str | None = None
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)


class UpdateDocsCardArgs(ToolArgs):
    shape_id: str
    title: str | None = None
    content: str | None = None

    @model_validator(mode="after")
    def require_update(self):
        if self.title is None and self.content is None:
            raise ValueError("title or content is required")
        return self


class ProjectTaskInput(ToolArgs):
    id: str | None = None
    text: str = Field(min_length=1)
    status: ProjectStatus = "todo"


class CreateProjectCardArgs(ToolArgs):
    title: str = Field(min_length=1)
    x: float
    y: float
    id: str | None = None
    tasks: list[ProjectTaskInput] = Field(default_factory=list)
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)
    color: TldrawColor | None = None


class UpdateProjectCardArgs(ToolArgs):
    shape_id: str
    title: str = Field(min_length=1)


class AppendProjectTaskArgs(ToolArgs):
    shape_id: str
    task_id: str
    text: str = Field(min_length=1)
    status: ProjectStatus = "todo"


class ProjectTaskTargetArgs(ToolArgs):
    shape_id: str
    task_id: str


class UpdateProjectTaskTextArgs(ProjectTaskTargetArgs):
    text: str = Field(min_length=1)


class MoveProjectTaskArgs(ProjectTaskTargetArgs):
    status: ProjectStatus
    before_task_id: str | None = None


class ArrangeShapesArgs(ShapeIdsArgs):
    layout: Literal["row", "column", "grid"]
    columns: int = Field(default=3, ge=1)
    gap: float = Field(default=32, ge=0)
    origin_x: float | None = None
    origin_y: float | None = None


@dataclass
class CanvasToolContext:
    client: CanvasGatewayClient
    canvas_id: str
    observation: CanvasObservation
    max_actions: int
    max_context_chars: int
    action_count: int = 0
    cancel_event: asyncio.Event | None = None
    _execution_lock: asyncio.Lock = field(
        default_factory=asyncio.Lock, init=False, repr=False
    )

    async def execute(
        self, actions: list[dict[str, Any]], *, read_only: bool = False
    ) -> str:
        async with self._execution_lock:
            if self.cancel_event and self.cancel_event.is_set():
                raise asyncio.CancelledError
            if self.action_count + len(actions) > self.max_actions:
                raise CanvasActionLimitExceeded(
                    f"Canvas action limit of {self.max_actions} exceeded. "
                    "Explain which earlier actions succeeded and what remains undone."
                )
            self.action_count += len(actions)
            execution = await self.client.execute(
                self.canvas_id, actions, read_only=read_only
            )
            self.observation = execution.observation
            return json.dumps(
                {
                    "results": [
                        result.model_dump(by_alias=True, exclude_none=True)
                        for result in execution.results
                    ],
                    "canvas": summarize_canvas(
                        self.observation, self.max_context_chars
                    ),
                },
                ensure_ascii=False,
            )


def build_canvas_tools(context: CanvasToolContext) -> list[BaseTool]:
    async def read_canvas(_: EmptyArgs) -> str:
        return await context.execute([{"type": "read_canvas"}], read_only=True)

    async def select_shapes(args: ShapeIdsArgs) -> str:
        _require_shapes(context, args.shape_ids)
        return await context.execute(
            [{"type": "select_shapes", "shapeIds": args.shape_ids}]
        )

    async def clear_selection(_: EmptyArgs) -> str:
        return await context.execute([{"type": "clear_selection"}])

    async def set_camera(args: SetCameraArgs) -> str:
        return await context.execute(
            [_drop_none({"type": "set_camera", "x": args.x, "y": args.y, "z": args.z})]
        )

    async def zoom_to_fit(_: EmptyArgs) -> str:
        return await context.execute([{"type": "zoom_to_fit"}])

    async def create_builtin(args: CreateBuiltinShapeArgs) -> str:
        _require_new_shape_id(context, args.id)
        shape = _drop_none(
            {
                "id": args.id,
                "type": args.shape_type,
                "x": args.x,
                "y": args.y,
                "rotation": args.rotation,
                "opacity": args.opacity,
                "props": args.props or None,
                "meta": args.meta or None,
            }
        )
        return await context.execute([{"type": "create_shape", "shape": shape}])

    async def update_builtin(args: UpdateBuiltinShapeArgs) -> str:
        _require_shape(context, args.shape_id)
        patch = _drop_none(
            {
                "x": args.x,
                "y": args.y,
                "rotation": args.rotation,
                "opacity": args.opacity,
                "props": args.props,
                "meta": args.meta,
            }
        )
        return await context.execute(
            [{"type": "update_shape", "shapeId": args.shape_id, "patch": patch}]
        )

    async def move_shapes(args: MoveShapesArgs) -> str:
        _require_shapes(context, args.shape_ids)
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "move_shapes",
                        "shapeIds": args.shape_ids,
                        "x": args.x,
                        "y": args.y,
                        "dx": args.dx,
                        "dy": args.dy,
                    }
                )
            ]
        )

    async def delete_shapes(args: ShapeIdsArgs) -> str:
        _require_shapes(context, args.shape_ids)
        return await context.execute(
            [{"type": "delete_shapes", "shapeIds": args.shape_ids}]
        )

    async def create_todo(args: CreateTodoBlockArgs) -> str:
        _require_new_shape_id(context, args.id)
        action = _drop_none(
            {
                "type": "create_todo_block",
                "id": args.id,
                "title": args.title,
                "x": args.x,
                "y": args.y,
                "tasks": [task.model_dump(exclude_none=True) for task in args.tasks],
                "w": args.w,
                "h": args.h,
                "backgroundColor": args.background_color,
            }
        )
        return await context.execute([action])

    async def append_todo(args: AppendTodoTaskArgs) -> str:
        _require_shape(context, args.shape_id, "todo_block")
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "append_todo_task",
                        "shapeId": args.shape_id,
                        "taskId": args.task_id,
                        "text": args.text,
                    }
                )
            ]
        )

    async def set_todo_done(args: SetTodoTaskDoneArgs) -> str:
        _require_task(context, args.shape_id, args.task_id, "todo_block", "todo")
        return await context.execute(
            [
                {
                    "type": "set_todo_task_done",
                    "shapeId": args.shape_id,
                    "taskId": args.task_id,
                    "done": args.done,
                }
            ]
        )

    async def remove_todo(args: TodoTaskTargetArgs) -> str:
        _require_task(context, args.shape_id, args.task_id, "todo_block", "todo")
        return await context.execute(
            [
                {
                    "type": "remove_todo_task",
                    "shapeId": args.shape_id,
                    "taskId": args.task_id,
                }
            ]
        )

    async def create_link(args: CreateLinkCardArgs) -> str:
        _require_new_shape_id(context, args.id)
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "create_link_card",
                        "id": args.id,
                        "title": args.title,
                        "url": args.url,
                        "description": args.description,
                        "imageUrl": args.image_url,
                        "w": args.w,
                        "h": args.h,
                        "backgroundColor": args.background_color,
                        "x": args.x,
                        "y": args.y,
                    }
                )
            ]
        )

    async def create_note(args: CreateNoteCardArgs) -> str:
        _require_new_shape_id(context, args.id)
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "create_note_card",
                        "id": args.id,
                        "title": args.title,
                        "tag": args.tag,
                        "content": args.content,
                        "color": args.color,
                        "size": args.size,
                        "x": args.x,
                        "y": args.y,
                    }
                )
            ]
        )

    async def create_docs(args: CreateDocsCardArgs) -> str:
        _require_new_shape_id(context, args.id)
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "create_docs_card",
                        "id": args.id,
                        "title": args.title,
                        "content": args.content,
                        "w": args.w,
                        "h": args.h,
                        "x": args.x,
                        "y": args.y,
                    }
                )
            ]
        )

    async def update_docs(args: UpdateDocsCardArgs) -> str:
        _require_shape(context, args.shape_id, "docs_card")
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "update_docs_card",
                        "shapeId": args.shape_id,
                        "title": args.title,
                        "content": args.content,
                    }
                )
            ]
        )

    async def create_project(args: CreateProjectCardArgs) -> str:
        _require_new_shape_id(context, args.id)
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "create_project_card",
                        "id": args.id,
                        "title": args.title,
                        "tasks": [task.model_dump(exclude_none=True) for task in args.tasks],
                        "w": args.w,
                        "h": args.h,
                        "color": args.color,
                        "x": args.x,
                        "y": args.y,
                    }
                )
            ]
        )

    async def update_project(args: UpdateProjectCardArgs) -> str:
        _require_shape(context, args.shape_id, "project_card")
        return await context.execute(
            [
                {
                    "type": "update_project_card",
                    "shapeId": args.shape_id,
                    "title": args.title,
                }
            ]
        )

    async def append_project(args: AppendProjectTaskArgs) -> str:
        _require_shape(context, args.shape_id, "project_card")
        return await context.execute(
            [
                {
                    "type": "append_project_task",
                    "shapeId": args.shape_id,
                    "taskId": args.task_id,
                    "text": args.text,
                    "status": args.status,
                }
            ]
        )

    async def update_project_text(args: UpdateProjectTaskTextArgs) -> str:
        _require_task(context, args.shape_id, args.task_id, "project_card", "project")
        return await context.execute(
            [
                {
                    "type": "update_project_task_text",
                    "shapeId": args.shape_id,
                    "taskId": args.task_id,
                    "text": args.text,
                }
            ]
        )

    async def move_project(args: MoveProjectTaskArgs) -> str:
        _require_task(context, args.shape_id, args.task_id, "project_card", "project")
        if args.before_task_id:
            _require_task(
                context, args.shape_id, args.before_task_id, "project_card", "project"
            )
        return await context.execute(
            [
                _drop_none(
                    {
                        "type": "move_project_task",
                        "shapeId": args.shape_id,
                        "taskId": args.task_id,
                        "status": args.status,
                        "beforeTaskId": args.before_task_id,
                    }
                )
            ]
        )

    async def remove_project(args: ProjectTaskTargetArgs) -> str:
        _require_task(context, args.shape_id, args.task_id, "project_card", "project")
        return await context.execute(
            [
                {
                    "type": "remove_project_task",
                    "shapeId": args.shape_id,
                    "taskId": args.task_id,
                }
            ]
        )

    async def arrange(args: ArrangeShapesArgs) -> str:
        positions = arrange_positions(
            context.observation,
            args.shape_ids,
            layout=args.layout,
            columns=args.columns,
            gap=args.gap,
            origin_x=args.origin_x,
            origin_y=args.origin_y,
        )
        actions = [
            {
                "type": "move_shapes",
                "shapeIds": [shape_id],
                "x": position[0],
                "y": position[1],
            }
            for shape_id, position in positions.items()
        ]
        return await context.execute(actions)

    specs: list[tuple[str, str, type[ToolArgs], ToolHandler[Any]]] = [
        ("read_canvas", "Read the latest canvas state.", EmptyArgs, read_canvas),
        ("select_shapes", "Select observed shapes in the browser.", ShapeIdsArgs, select_shapes),
        ("clear_selection", "Clear the current browser selection.", EmptyArgs, clear_selection),
        ("set_camera", "Set the canvas camera position and zoom.", SetCameraArgs, set_camera),
        ("zoom_to_fit", "Zoom the browser to fit all shapes.", EmptyArgs, zoom_to_fit),
        ("create_builtin_shape", "Create a built-in tldraw shape.", CreateBuiltinShapeArgs, create_builtin),
        ("update_builtin_shape", "Update an observed built-in shape.", UpdateBuiltinShapeArgs, update_builtin),
        ("move_shapes", "Move observed shapes.", MoveShapesArgs, move_shapes),
        ("delete_shapes", "Delete observed shapes.", ShapeIdsArgs, delete_shapes),
        ("create_todo_block", "Create a Todo block.", CreateTodoBlockArgs, create_todo),
        ("append_todo_task", "Append a task to a Todo block.", AppendTodoTaskArgs, append_todo),
        ("set_todo_task_done", "Set a Todo task completion state.", SetTodoTaskDoneArgs, set_todo_done),
        ("remove_todo_task", "Remove a task from a Todo block.", TodoTaskTargetArgs, remove_todo),
        ("create_link_card", "Create a Link card.", CreateLinkCardArgs, create_link),
        ("create_note_card", "Create a native tldraw note card.", CreateNoteCardArgs, create_note),
        ("create_docs_card", "Create a Markdown Docs card.", CreateDocsCardArgs, create_docs),
        ("update_docs_card", "Update an observed Docs card.", UpdateDocsCardArgs, update_docs),
        ("create_project_card", "Create a Project task board.", CreateProjectCardArgs, create_project),
        ("update_project_card", "Update an observed Project title.", UpdateProjectCardArgs, update_project),
        ("append_project_task", "Append a Project task.", AppendProjectTaskArgs, append_project),
        ("update_project_task_text", "Update Project task text.", UpdateProjectTaskTextArgs, update_project_text),
        ("move_project_task", "Move and reorder a Project task.", MoveProjectTaskArgs, move_project),
        ("remove_project_task", "Remove a Project task.", ProjectTaskTargetArgs, remove_project),
        ("arrange_shapes", "Arrange observed shapes in a row, column, or grid.", ArrangeShapesArgs, arrange),
    ]
    return [
        _structured_tool(name, description, schema, handler)
        for name, description, schema, handler in specs
    ]


def _structured_tool(
    name: str,
    description: str,
    schema: type[TArgs],
    handler: ToolHandler[TArgs],
) -> BaseTool:
    async def invoke(**kwargs: Any) -> str:
        return await handler(schema.model_validate(kwargs))

    return StructuredTool.from_function(
        coroutine=invoke,
        name=name,
        description=description,
        args_schema=schema,
        handle_tool_error=True,
    )


def _require_shapes(context: CanvasToolContext, shape_ids: list[str]) -> None:
    for shape_id in shape_ids:
        _require_shape(context, shape_id)


def _require_new_shape_id(context: CanvasToolContext, shape_id: str | None) -> None:
    if shape_id and any(shape.id == shape_id for shape in context.observation.shapes):
        raise ValueError(f"Shape {shape_id} already exists")


def _require_shape(
    context: CanvasToolContext, shape_id: str, expected_type: str | None = None
) -> CanvasShape:
    shape = next((item for item in context.observation.shapes if item.id == shape_id), None)
    if shape is None:
        raise ValueError(f"Unknown shape {shape_id}")
    if expected_type and shape.type != expected_type:
        raise ValueError(f"Shape {shape_id} is not a {expected_type}")
    return shape


def _require_task(
    context: CanvasToolContext,
    shape_id: str,
    task_id: str,
    expected_type: str,
    task_kind: str,
) -> None:
    shape = _require_shape(context, shape_id, expected_type)
    tasks = shape.props.get("tasks")
    if not isinstance(tasks, list) or not any(
        isinstance(task, dict) and task.get("id") == task_id for task in tasks
    ):
        raise ValueError(f"Unknown {task_kind} task {task_id}")


def _drop_none(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}

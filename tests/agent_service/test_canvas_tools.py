import asyncio

import pytest

from agent_service.canvas_tools import CanvasToolContext, build_canvas_tools
from agent_service.models import CanvasExecution


EXPECTED_TOOL_NAMES = {
    "read_canvas",
    "select_shapes",
    "clear_selection",
    "set_camera",
    "zoom_to_fit",
    "create_builtin_shape",
    "update_builtin_shape",
    "move_shapes",
    "delete_shapes",
    "create_todo_block",
    "append_todo_task",
    "set_todo_task_done",
    "remove_todo_task",
    "create_link_card",
    "create_note_card",
    "create_docs_card",
    "update_docs_card",
    "create_project_card",
    "update_project_card",
    "append_project_task",
    "update_project_task_text",
    "move_project_task",
    "remove_project_task",
    "arrange_shapes",
}


class FakeClient:
    def __init__(self, execution: CanvasExecution):
        self.execution = execution
        self.calls = []

    async def execute(self, canvas_id, actions, *, read_only=False):
        self.calls.append((canvas_id, actions, read_only))
        return self.execution


class ConcurrentClient(FakeClient):
    def __init__(self, execution: CanvasExecution):
        super().__init__(execution)
        self.active = 0
        self.max_active = 0

    async def execute(self, canvas_id, actions, *, read_only=False):
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0.01)
        try:
            return await super().execute(canvas_id, actions, read_only=read_only)
        finally:
            self.active -= 1


def tools_for(context: CanvasToolContext):
    return {tool.name: tool for tool in build_canvas_tools(context)}


def test_builds_the_complete_typed_tool_surface(empty_execution):
    context = CanvasToolContext(
        FakeClient(empty_execution), "canvas_001", empty_execution.observation, 40, 24000
    )

    assert set(tools_for(context)) == EXPECTED_TOOL_NAMES


@pytest.mark.asyncio
async def test_create_todo_tool_uses_existing_action_schema(empty_execution):
    client = FakeClient(empty_execution)
    context = CanvasToolContext(
        client, "canvas_001", empty_execution.observation, 40, 24000
    )

    await tools_for(context)["create_todo_block"].ainvoke(
        {"title": "Launch", "x": 10, "y": 20, "tasks": [{"text": "Ship"}]}
    )

    assert client.calls[0] == (
        "canvas_001",
        [
            {
                "type": "create_todo_block",
                "title": "Launch",
                "x": 10.0,
                "y": 20.0,
                "tasks": [{"text": "Ship", "done": False}],
            }
        ],
        False,
    )


@pytest.mark.asyncio
async def test_custom_update_validates_observed_shape_and_task_ids(empty_execution):
    execution = CanvasExecution.model_validate(
        {
            "results": [{"actionType": "read_canvas"}],
            "observation": {
                "canvasId": "canvas_001",
                "pageId": "page:page",
                "selectedShapeIds": [],
                "camera": {"x": 0, "y": 0, "z": 1},
                "shapes": [
                    {
                        "id": "shape:todo",
                        "type": "todo_block",
                        "x": 0,
                        "y": 0,
                        "props": {"tasks": [{"id": "task:ship", "text": "Ship"}]},
                        "meta": {},
                    }
                ],
            },
        }
    )
    client = FakeClient(execution)
    context = CanvasToolContext(client, "canvas_001", execution.observation, 40, 24000)
    tools = tools_for(context)

    await tools["set_todo_task_done"].ainvoke(
        {"shape_id": "shape:todo", "task_id": "task:ship", "done": True}
    )
    assert client.calls[0][1] == [
        {
            "type": "set_todo_task_done",
            "shapeId": "shape:todo",
            "taskId": "task:ship",
            "done": True,
        }
    ]

    with pytest.raises(ValueError, match="Unknown todo task"):
        await tools["set_todo_task_done"].ainvoke(
            {"shape_id": "shape:todo", "task_id": "task:missing", "done": True}
        )


@pytest.mark.asyncio
async def test_arrange_shapes_emits_ordered_move_actions(empty_execution):
    execution = CanvasExecution.model_validate(
        {
            "results": [{"actionType": "read_canvas"}],
            "observation": {
                "canvasId": "canvas_001",
                "pageId": "page:page",
                "selectedShapeIds": [],
                "camera": {"x": 0, "y": 0, "z": 1},
                "shapes": [
                    {"id": "shape:a", "type": "geo", "x": 0, "y": 0,
                     "props": {"w": 100, "h": 80}, "meta": {}},
                    {"id": "shape:b", "type": "geo", "x": 400, "y": 0,
                     "props": {"w": 120, "h": 80}, "meta": {}},
                ],
            },
        }
    )
    client = FakeClient(execution)
    context = CanvasToolContext(client, "canvas_001", execution.observation, 40, 24000)

    await tools_for(context)["arrange_shapes"].ainvoke(
        {"shape_ids": ["shape:a", "shape:b"], "layout": "row", "gap": 20}
    )

    assert client.calls[0][1] == [
        {"type": "move_shapes", "shapeIds": ["shape:a"], "x": 0.0, "y": 0.0},
        {"type": "move_shapes", "shapeIds": ["shape:b"], "x": 120.0, "y": 0.0},
    ]


@pytest.mark.asyncio
async def test_tool_context_rejects_actions_over_turn_limit(empty_execution):
    context = CanvasToolContext(
        FakeClient(empty_execution), "canvas_001", empty_execution.observation, 1, 24000
    )
    await context.execute([{"type": "read_canvas"}], read_only=True)

    with pytest.raises(ValueError, match="action limit"):
        await context.execute([{"type": "read_canvas"}], read_only=True)


@pytest.mark.asyncio
async def test_cancelled_context_never_sends_an_action(empty_execution):
    cancel_event = asyncio.Event()
    cancel_event.set()
    client = FakeClient(empty_execution)
    context = CanvasToolContext(
        client,
        "canvas_001",
        empty_execution.observation,
        40,
        24000,
        cancel_event=cancel_event,
    )

    with pytest.raises(asyncio.CancelledError):
        await context.execute([{"type": "zoom_to_fit"}])

    assert client.calls == []


@pytest.mark.asyncio
async def test_tool_context_serializes_parallel_gateway_calls(empty_execution):
    client = ConcurrentClient(empty_execution)
    context = CanvasToolContext(
        client, "canvas_001", empty_execution.observation, 40, 24000
    )

    await asyncio.gather(
        context.execute([{"type": "read_canvas"}], read_only=True),
        context.execute([{"type": "read_canvas"}], read_only=True),
    )

    assert client.max_active == 1
    assert context.action_count == 2


@pytest.mark.asyncio
async def test_create_tools_reject_an_observed_shape_id(empty_execution):
    payload = empty_execution.observation.model_dump(by_alias=True)
    payload["shapes"] = [
        {
            "id": "shape:existing",
            "type": "geo",
            "x": 0,
            "y": 0,
            "props": {},
            "meta": {},
        }
    ]
    observation = type(empty_execution.observation).model_validate(payload)
    context = CanvasToolContext(
        FakeClient(empty_execution), "canvas_001", observation, 40, 24000
    )

    with pytest.raises(ValueError, match="already exists"):
        await tools_for(context)["create_builtin_shape"].ainvoke(
            {"id": "shape:existing", "shape_type": "geo"}
        )

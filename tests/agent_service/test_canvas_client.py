import asyncio
import json

import pytest

from agent_service.canvas_client import CanvasGatewayClient, CanvasIndeterminateWrite


class FakeSocket:
    def __init__(self, replies, fail_after_send=False):
        self.replies = iter(replies)
        self.fail_after_send = fail_after_send
        self.sent = []
        self.closed = False

    async def send(self, value):
        self.sent.append(json.loads(value))

    async def recv(self):
        if self.fail_after_send:
            raise ConnectionError("lost")
        return json.dumps(next(self.replies))

    async def close(self):
        self.closed = True


class BlockingSocket(FakeSocket):
    def __init__(self):
        super().__init__([])
        self.sent_event = asyncio.Event()

    async def send(self, value):
        await super().send(value)
        self.sent_event.set()

    async def recv(self):
        await asyncio.Event().wait()
        raise AssertionError("unreachable")


@pytest.mark.asyncio
async def test_execute_waits_for_matching_result_and_observation():
    socket = FakeSocket(
        [
            {
                "type": "canvas.result",
                "requestId": "req_fixed",
                "ok": True,
                "results": [{"actionType": "read_canvas"}],
            },
            {
                "type": "canvas.observation",
                "requestId": "req_fixed",
                "canvasId": "canvas_001",
                "state": {
                    "canvasId": "canvas_001",
                    "pageId": "page:page",
                    "selectedShapeIds": [],
                    "camera": {"x": 0, "y": 0, "z": 1},
                    "viewportPageBounds": {"x": 10, "y": 20, "w": 800, "h": 600},
                    "shapes": [],
                },
            },
        ]
    )

    async def connect(_):
        return socket

    client = CanvasGatewayClient(
        "ws://gateway/canvas", connector=connect, request_id_factory=lambda: "req_fixed"
    )
    result = await client.execute(
        "canvas_001", [{"type": "read_canvas"}], read_only=True
    )

    assert result.observation.shapes == []
    assert result.observation.viewport_page_bounds is not None
    assert result.observation.viewport_page_bounds.w == 800
    assert socket.sent[0]["canvasId"] == "canvas_001"
    assert socket.closed is True


@pytest.mark.asyncio
async def test_execute_ignores_envelopes_for_other_requests():
    socket = FakeSocket(
        [
            {
                "type": "canvas.result",
                "requestId": "req_other",
                "ok": True,
                "results": [],
            },
            {
                "type": "canvas.result",
                "requestId": "req_fixed",
                "ok": True,
                "results": [{"actionType": "read_canvas"}],
            },
            {
                "type": "canvas.observation",
                "requestId": "req_fixed",
                "canvasId": "canvas_001",
                "state": {
                    "canvasId": "canvas_001",
                    "pageId": "page:page",
                    "selectedShapeIds": [],
                    "camera": {"x": 0, "y": 0, "z": 1},
                    "shapes": [],
                },
            },
        ]
    )

    async def connect(_):
        return socket

    client = CanvasGatewayClient(
        "ws://gateway/canvas", connector=connect, request_id_factory=lambda: "req_fixed"
    )
    result = await client.execute(
        "canvas_001", [{"type": "read_canvas"}], read_only=True
    )

    assert result.results[0].action_type == "read_canvas"


@pytest.mark.asyncio
async def test_mutation_disconnect_after_send_is_not_retried():
    socket = FakeSocket([], fail_after_send=True)
    connections = 0

    async def connect(_):
        nonlocal connections
        connections += 1
        return socket

    client = CanvasGatewayClient(
        "ws://gateway/canvas",
        connector=connect,
        request_id_factory=lambda: "req_fixed",
        retry_count=3,
    )

    with pytest.raises(CanvasIndeterminateWrite):
        await client.execute(
            "canvas_001", [{"type": "delete_shapes", "shapeIds": ["shape:a"]}]
        )

    assert len(socket.sent) == 1
    assert connections == 1


@pytest.mark.asyncio
async def test_mutation_cancelled_after_send_is_indeterminate():
    socket = BlockingSocket()

    async def connect(_):
        return socket

    client = CanvasGatewayClient(
        "ws://gateway/canvas",
        connector=connect,
        request_id_factory=lambda: "req_fixed",
    )
    task = asyncio.create_task(
        client.execute("canvas_001", [{"type": "create_note_card"}])
    )
    await socket.sent_event.wait()
    task.cancel()

    with pytest.raises(CanvasIndeterminateWrite):
        await task

    assert socket.closed is True

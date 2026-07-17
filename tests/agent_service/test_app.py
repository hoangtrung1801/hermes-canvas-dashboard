import asyncio
import json
from pathlib import Path
from threading import Event, Thread

from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware

from agent_service.app import create_app
from agent_service.canvas_client import CanvasIndeterminateWrite


class CancelRecordingTask:
    def __init__(self) -> None:
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True


class IndeterminateRuntime:
    async def stream_turn(self, **kwargs):
        del kwargs
        if False:
            yield
        raise CanvasIndeterminateWrite("raw transport details")

    async def get_display_messages(self, conversation_id):
        del conversation_id
        return []


class BlockingRuntime:
    def __init__(self) -> None:
        self.started = Event()

    async def stream_turn(self, **kwargs):
        del kwargs
        self.started.set()
        await asyncio.Event().wait()
        if False:
            yield

    async def get_display_messages(self, conversation_id):
        del conversation_id
        return []


def _sse_events(body: str) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    for block in body.strip().split("\n\n"):
        lines = block.splitlines()
        name = next(line.removeprefix("event: ") for line in lines if line.startswith("event: "))
        data = next(line.removeprefix("data: ") for line in lines if line.startswith("data: "))
        events.append((name, json.loads(data)))
    return events


def test_conversation_lifecycle_messages_and_stream(test_dependencies) -> None:
    app = create_app(**test_dependencies)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        created_response = client.post("/api/canvases/canvas_001/conversations")
        assert created_response.status_code == 201
        created = created_response.json()
        assert created["canvas_id"] == "canvas_001"
        assert created["is_active"] is True

        second = client.post("/api/canvases/canvas_001/conversations").json()
        activated = client.post(
            f"/api/conversations/{created['id']}/activate"
        ).json()
        assert activated["id"] == created["id"]
        assert activated["is_active"] is True
        listed = client.get("/api/canvases/canvas_001/conversations").json()
        assert listed[0]["id"] == created["id"]
        assert next(item for item in listed if item["id"] == second["id"])["is_active"] is False

        with client.stream(
            "POST",
            f"/api/conversations/{created['id']}/messages:stream",
            json={"message": "  Create a note  "},
        ) as response:
            body = "".join(response.iter_text())
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        events = _sse_events(body)
        assert [name for name, _ in events] == [
            "run.started",
            "assistant.delta",
            "assistant.completed",
            "stream.done",
        ]
        run_id = events[0][1]["run_id"]
        assert events[0][1]["user_message"] == {
            "id": f"user:{run_id}",
            "role": "user",
            "content": "Create a note",
        }
        assert events[1][1] == {"message_id": "msg_assistant", "text": "Done"}
        assert events[2][1] == {
            "message": {
                "id": "msg_assistant",
                "role": "assistant",
                "content": "Done",
            }
        }
        assert events[-1][1] == {"run_id": run_id}
        assert client.get(f"/api/conversations/{created['id']}/messages").json()[1][
            "content"
        ] == "Done"
        renamed = client.get("/api/canvases/canvas_001/conversations").json()[0]
        assert renamed["title"] == "Create a note"


def test_busy_conversation_returns_conflict_and_cancel_sets_event(
    test_dependencies,
) -> None:
    app = create_app(**test_dependencies)
    with TestClient(app) as client:
        conversation = client.post("/api/canvases/canvas_001/conversations").json()
        lock = asyncio.Lock()
        asyncio.run(lock.acquire())
        app.state.conversation_locks[conversation["id"]] = lock
        response = client.post(
            f"/api/conversations/{conversation['id']}/messages:stream",
            json={"message": "Create a note"},
        )
        assert response.status_code == 409
        lock.release()

        cancel_event = asyncio.Event()
        app.state.cancel_events["run_active"] = cancel_event
        task = CancelRecordingTask()
        app.state.run_tasks["run_active"] = task
        response = client.post("/api/runs/run_active/cancel")
        assert response.status_code == 202
        assert cancel_event.is_set()
        assert task.cancelled is True
        assert client.post("/api/runs/missing/cancel").status_code == 404


def test_unknown_ids_and_invalid_messages_are_rejected(test_dependencies) -> None:
    app = create_app(**test_dependencies)
    with TestClient(app) as client:
        assert client.post("/api/conversations/missing/activate").status_code == 404
        assert client.get("/api/conversations/missing/messages").status_code == 404
        assert (
            client.post(
                "/api/conversations/missing/messages:stream",
                json={"message": "Hello"},
            ).status_code
            == 404
        )
        conversation = client.post("/api/canvases/canvas_001/conversations").json()
        url = f"/api/conversations/{conversation['id']}/messages:stream"
        assert client.post(url, json={"message": "   "}).status_code == 422
        assert client.post(url, json={"message": "x" * 20_001}).status_code == 422


def test_default_app_reads_cors_origins_from_dotenv(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("AI_ALLOWED_ORIGINS", raising=False)
    (tmp_path / ".env").write_text(
        "AI_ALLOWED_ORIGINS=https://canvas.example,https://admin.example\n"
    )

    app = create_app()

    cors = next(
        middleware
        for middleware in app.user_middleware
        if middleware.cls is CORSMiddleware
    )
    assert cors.kwargs["allow_origins"] == [
        "https://canvas.example",
        "https://admin.example",
    ]


def test_indeterminate_write_is_not_retryable(test_dependencies) -> None:
    dependencies = {**test_dependencies, "runtime": IndeterminateRuntime()}
    app = create_app(**dependencies)
    with TestClient(app) as client:
        conversation = client.post("/api/canvases/canvas_001/conversations").json()
        response = client.post(
            f"/api/conversations/{conversation['id']}/messages:stream",
            json={"message": "Create a card"},
        )

    events = _sse_events(response.text)
    failed = next(data for event, data in events if event == "run.failed")
    assert failed == {
        "run_id": events[0][1]["run_id"],
        "code": "indeterminate_write",
        "message": (
            "A canvas action may have completed. "
            "Refresh and inspect the canvas before retrying."
        ),
        "retryable": False,
    }
    assert "raw transport details" not in response.text


def test_cancelled_stream_emits_terminal_events_before_closing(test_dependencies) -> None:
    runtime = BlockingRuntime()
    dependencies = {**test_dependencies, "runtime": runtime}
    app = create_app(**dependencies)
    holder: dict[str, object] = {}

    with TestClient(app) as client:
        conversation = client.post("/api/canvases/canvas_001/conversations").json()

        def stream_request() -> None:
            holder["response"] = client.post(
                f"/api/conversations/{conversation['id']}/messages:stream",
                json={"message": "Create a card"},
            )

        thread = Thread(target=stream_request)
        thread.start()
        assert runtime.started.wait(timeout=2)
        run_id = next(iter(app.state.run_tasks))

        assert client.post(f"/api/runs/{run_id}/cancel").status_code == 202
        thread.join(timeout=2)

    assert not thread.is_alive()
    response = holder["response"]
    events = _sse_events(response.text)  # type: ignore[union-attr]
    assert [event for event, _ in events][-2:] == ["run.cancelled", "stream.done"]

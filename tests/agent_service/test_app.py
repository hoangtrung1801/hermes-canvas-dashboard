import asyncio
import json

from fastapi.testclient import TestClient

from agent_service.app import create_app


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
        response = client.post("/api/runs/run_active/cancel")
        assert response.status_code == 202
        assert cancel_event.is_set()
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

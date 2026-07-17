from collections.abc import AsyncIterator

import pytest

from agent_service.config import Settings
from agent_service.models import CanvasExecution, StreamEvent
from agent_service.repository import ConversationRepository


@pytest.fixture
def empty_execution() -> CanvasExecution:
    return CanvasExecution.model_validate(
        {
            "results": [{"actionType": "read_canvas"}],
            "observation": {
                "canvasId": "canvas_001",
                "pageId": "page:page",
                "selectedShapeIds": [],
                "camera": {"x": 0, "y": 0, "z": 1},
                "shapes": [],
            },
        }
    )


class FakeAgentRuntime:
    def __init__(self) -> None:
        self.turns: list[dict[str, object]] = []

    async def stream_turn(self, **kwargs: object) -> AsyncIterator[StreamEvent]:
        self.turns.append(kwargs)
        yield StreamEvent(
            event="assistant.delta",
            data={"message_id": "msg_assistant", "delta": "Done"},
        )
        yield StreamEvent(
            event="assistant.completed",
            data={"message_id": "msg_assistant", "content": "Done"},
        )

    async def get_display_messages(self, conversation_id: str) -> list[dict[str, str]]:
        del conversation_id
        return [
            {"id": "msg_user", "role": "user", "content": "Create a note"},
            {"id": "msg_assistant", "role": "assistant", "content": "Done"},
        ]


@pytest.fixture
def test_dependencies(tmp_path) -> dict[str, object]:
    settings = Settings(
        ai_model_base_url="https://models.invalid/v1",
        ai_model_api_key="test-secret",
        ai_model_name="tool-model",
        ai_database_path=tmp_path / "agent.sqlite",
    )
    return {
        "settings": settings,
        "runtime": FakeAgentRuntime(),
        "repository": ConversationRepository(settings.ai_database_path),
    }

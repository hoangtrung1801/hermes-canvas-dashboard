import asyncio
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

import agent_service.agent as agent_module
from agent_service.agent import AgentRuntime
from agent_service.config import Settings
from agent_service.models import CanvasExecution


class RecordingCanvasClient:
    def __init__(self, execution: CanvasExecution):
        self.execution = execution
        self.calls: list[tuple[str, list[dict[str, Any]], bool]] = []

    async def execute(
        self, canvas_id: str, actions: list[dict[str, Any]], *, read_only: bool = False
    ) -> CanvasExecution:
        self.calls.append((canvas_id, actions, read_only))
        return self.execution


class FakeAgent:
    def __init__(self, events: list[dict[str, Any]]):
        self.events = events
        self.calls: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]] = []

    async def astream(
        self,
        payload: dict[str, Any],
        config: dict[str, Any],
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        self.calls.append((payload, config, kwargs))
        for event in self.events:
            yield event


class FakeCheckpointer:
    def __init__(self, messages: list[Any] | None = None):
        self.messages = messages or []

    async def aget_tuple(self, config: dict[str, Any]) -> Any:
        del config
        return SimpleNamespace(
            checkpoint={"channel_values": {"messages": self.messages}}
        )


def test_runtime_passes_configured_reasoning_effort_to_chat_model(
    settings: Settings,
    empty_execution: CanvasExecution,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def fake_chat_openai(**kwargs: Any) -> FakeListChatModel:
        captured.update(kwargs)
        return FakeListChatModel(responses=["unused"])

    monkeypatch.setattr(agent_module, "ChatOpenAI", fake_chat_openai)
    settings.ai_model_reasoning_effort = "none"

    AgentRuntime(
        settings=settings,
        checkpointer=FakeCheckpointer(),
        canvas_client=RecordingCanvasClient(empty_execution),
    )

    assert captured["reasoning_effort"] == "none"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        ai_model_base_url="https://models.invalid/v1",
        ai_model_api_key="test-secret",
        ai_model_name="tool-model",
        ai_database_path=tmp_path / "agent.sqlite",
    )


@pytest.mark.asyncio
async def test_stream_turn_prereads_canvas_and_emits_sanitized_events(
    settings: Settings, empty_execution: CanvasExecution
) -> None:
    raw_tool_output = '{"secret":"must not reach the browser"}'
    agent = FakeAgent(
        [
            {
                "type": "updates",
                "data": {
                    "model": {
                        "messages": [
                            AIMessage(
                                content="",
                                tool_calls=[
                                    {
                                        "name": "create_note_card",
                                        "args": {
                                            "title": "Launch notes",
                                            "tag": "work",
                                            "x": 10,
                                            "y": 20,
                                        },
                                        "id": "call_1",
                                        "type": "tool_call",
                                    }
                                ],
                            )
                        ]
                    }
                },
            },
            {
                "type": "updates",
                "data": {
                    "tools": {
                        "messages": [
                            ToolMessage(
                                content=raw_tool_output,
                                tool_call_id="call_1",
                                name="create_note_card",
                            )
                        ]
                    }
                },
            },
            {
                "type": "messages",
                "data": (
                    AIMessageChunk(content="Created the note."),
                    {"langgraph_node": "model"},
                ),
            },
        ]
    )
    factory_args: dict[str, Any] = {}

    def agent_factory(*args: Any, **kwargs: Any) -> FakeAgent:
        factory_args["args"] = args
        factory_args.update(kwargs)
        return agent

    canvas_client = RecordingCanvasClient(empty_execution)
    runtime = AgentRuntime(
        settings=settings,
        checkpointer=FakeCheckpointer(),
        canvas_client=canvas_client,
        model=FakeListChatModel(responses=["unused"]),
        agent_factory=agent_factory,
        message_id_factory=lambda: "msg_assistant",
    )

    events = [
        event
        async for event in runtime.stream_turn(
            conversation_id="conversation_1",
            canvas_id="canvas_001",
            message="Create a launch note",
            cancel_event=asyncio.Event(),
        )
    ]

    assert canvas_client.calls == [
        ("canvas_001", [{"type": "read_canvas"}], True)
    ]
    assert [event.event for event in events] == [
        "tool.started",
        "tool.completed",
        "assistant.delta",
        "assistant.completed",
    ]
    assert events[0].data == {
        "call_id": "call_1",
        "name": "create_note_card",
        "summary": "Creating note card",
    }
    assert events[1].data == {
        "call_id": "call_1",
        "name": "create_note_card",
        "summary": "Created note card",
        "status": "success",
    }
    assert raw_tool_output not in "".join(event.model_dump_json() for event in events)
    assert events[2].data == {"message_id": "msg_assistant", "delta": "Created the note."}
    assert events[3].data == {
        "message_id": "msg_assistant",
        "content": "Created the note.",
    }
    assert "CURRENT CANVAS" in factory_args["system_prompt"]
    assert "canvas: canvas_001" in factory_args["system_prompt"]
    assert "untrusted" in factory_args["system_prompt"].lower()
    assert "destructive" in factory_args["system_prompt"].lower()
    assert "partial failures" in factory_args["system_prompt"].lower()
    assert "smallest action set" in factory_args["system_prompt"].lower()
    assert [type(item).__name__ for item in factory_args["middleware"]] == [
        "SummarizationMiddleware",
        "ToolCallLimitMiddleware",
    ]
    assert factory_args["middleware"][1].exit_behavior == "continue"
    assert factory_args["checkpointer"] is runtime.checkpointer
    assert len(factory_args["tools"]) == 24
    assert agent.calls[0][1] == {
        "configurable": {"thread_id": "conversation_1"}
    }
    assert agent.calls[0][2] == {
        "stream_mode": ["messages", "updates"],
        "version": "v2",
    }


@pytest.mark.asyncio
async def test_stream_turn_honors_cancellation_before_canvas_access(
    settings: Settings, empty_execution: CanvasExecution
) -> None:
    cancel_event = asyncio.Event()
    cancel_event.set()
    canvas_client = RecordingCanvasClient(empty_execution)
    runtime = AgentRuntime(
        settings=settings,
        checkpointer=FakeCheckpointer(),
        canvas_client=canvas_client,
        model=FakeListChatModel(responses=["unused"]),
    )

    with pytest.raises(asyncio.CancelledError):
        _ = [
            event
            async for event in runtime.stream_turn(
                conversation_id="conversation_1",
                canvas_id="canvas_001",
                message="Do something",
                cancel_event=cancel_event,
            )
        ]

    assert canvas_client.calls == []


@pytest.mark.asyncio
async def test_get_display_messages_filters_internal_tool_messages(
    settings: Settings, empty_execution: CanvasExecution
) -> None:
    checkpointer = FakeCheckpointer(
        [
            HumanMessage(id="human_1", content="Make a note"),
            HumanMessage(
                id="summary_1",
                content="Here is a summary of internal tool and canvas state",
                additional_kwargs={"lc_source": "summarization"},
            ),
            AIMessage(
                id="tool_request",
                content="",
                tool_calls=[
                    {
                        "name": "create_note_card",
                        "args": {},
                        "id": "call_1",
                        "type": "tool_call",
                    }
                ],
            ),
            ToolMessage(
                id="tool_result",
                content="raw internal result",
                tool_call_id="call_1",
            ),
            AIMessage(id="assistant_1", content="The note is ready."),
        ]
    )
    runtime = AgentRuntime(
        settings=settings,
        checkpointer=checkpointer,
        canvas_client=RecordingCanvasClient(empty_execution),
        model=FakeListChatModel(responses=["unused"]),
    )

    messages = await runtime.get_display_messages("conversation_1")

    assert messages == [
        {"id": "human_1", "role": "user", "content": "Make a note"},
        {
            "id": "assistant_1",
            "role": "assistant",
            "content": "The note is ready.",
        },
    ]

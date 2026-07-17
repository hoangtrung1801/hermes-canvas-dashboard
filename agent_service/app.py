import asyncio
import json
import logging
import os
from collections.abc import AsyncIterator
from contextlib import AsyncExitStack, asynccontextmanager
from time import monotonic
from typing import Any

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from agent_service.agent import AgentRuntime
from agent_service.canvas_client import CanvasGatewayClient
from agent_service.config import Settings, get_settings
from agent_service.models import StreamEvent
from agent_service.persistence import open_checkpointer
from agent_service.repository import ConversationRepository

logger = logging.getLogger(__name__)


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message must not be blank")
        return value


def encode_sse(event: StreamEvent) -> bytes:
    payload = json.dumps(event.data, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event.event}\ndata: {payload}\n\n".encode()


def create_app(
    settings: Settings | None = None,
    runtime: AgentRuntime | None = None,
    repository: ConversationRepository | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        resolved_settings = settings or get_settings()
        resolved_repository = repository or ConversationRepository(
            resolved_settings.ai_database_path
        )
        await resolved_repository.setup()
        application.state.settings = resolved_settings
        application.state.repository = resolved_repository

        async with AsyncExitStack() as stack:
            if runtime is None:
                checkpointer = await stack.enter_async_context(
                    open_checkpointer(resolved_settings.ai_database_path)
                )
                canvas_client = CanvasGatewayClient(
                    resolved_settings.canvas_gateway_url,
                    timeout_seconds=resolved_settings.canvas_request_timeout_seconds,
                    retry_count=resolved_settings.canvas_request_retry_count,
                )
                application.state.runtime = AgentRuntime(
                    settings=resolved_settings,
                    checkpointer=checkpointer,
                    canvas_client=canvas_client,
                )
            else:
                application.state.runtime = runtime
            yield

    application = FastAPI(title="Hermes Canvas Agent", lifespan=lifespan)
    application.state.conversation_locks = {}
    application.state.cancel_events = {}
    application.state.run_tasks = {}

    origins = (
        settings.allowed_origins
        if settings is not None
        else [
            value.strip()
            for value in os.getenv(
                "AI_ALLOWED_ORIGINS", "http://localhost:5173"
            ).split(",")
            if value.strip()
        ]
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/canvases/{canvas_id}/conversations")
    async def list_conversations(canvas_id: str) -> list[dict[str, Any]]:
        conversations = await _repository(application).list_conversations(canvas_id)
        return [item.model_dump(mode="json") for item in conversations]

    @application.post(
        "/api/canvases/{canvas_id}/conversations",
        status_code=status.HTTP_201_CREATED,
    )
    async def create_conversation(canvas_id: str) -> dict[str, Any]:
        conversation = await _repository(application).create_conversation(canvas_id)
        return conversation.model_dump(mode="json")

    @application.post("/api/conversations/{conversation_id}/activate")
    async def activate_conversation(conversation_id: str) -> dict[str, Any]:
        try:
            conversation = await _repository(application).activate_conversation(
                conversation_id
            )
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Conversation not found") from error
        return conversation.model_dump(mode="json")

    @application.get("/api/conversations/{conversation_id}/messages")
    async def get_messages(conversation_id: str) -> list[dict[str, str]]:
        await _require_conversation(application, conversation_id)
        return await _runtime(application).get_display_messages(conversation_id)

    @application.post("/api/conversations/{conversation_id}/messages:stream")
    async def stream_message(
        conversation_id: str, request: MessageRequest
    ) -> StreamingResponse:
        conversation = await _require_conversation(application, conversation_id)
        locks: dict[str, asyncio.Lock] = application.state.conversation_locks
        lock = locks.setdefault(conversation_id, asyncio.Lock())
        if lock.locked():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A turn is already running for this conversation",
            )
        await lock.acquire()

        try:
            run = await _repository(application).start_run(conversation_id)
            await _repository(application).update_title_from_first_message(
                conversation_id, request.message
            )
        except Exception:
            lock.release()
            raise

        cancel_event = asyncio.Event()
        application.state.cancel_events[run.id] = cancel_event
        started = monotonic()
        logger.info(
            "canvas_agent_run_started",
            extra={
                "run_id": run.id,
                "conversation_id": conversation_id,
                "canvas_id": conversation.canvas_id,
                "status": "running",
            },
        )

        async def generate() -> AsyncIterator[bytes]:
            terminal_status = "completed"
            error_code: str | None = None
            application.state.run_tasks[run.id] = asyncio.current_task()
            try:
                yield encode_sse(
                    StreamEvent(
                        event="run.started",
                        data={
                            "run_id": run.id,
                            "user_message": {
                                "id": f"user:{run.id}",
                                "role": "user",
                                "content": request.message,
                            },
                        },
                    )
                )
                async for internal_event in _runtime(application).stream_turn(
                    conversation_id=conversation_id,
                    canvas_id=conversation.canvas_id,
                    message=request.message,
                    cancel_event=cancel_event,
                ):
                    public_event = _public_runtime_event(internal_event)
                    if public_event is None:
                        continue
                    if public_event.event == "tool.completed":
                        logger.info(
                            "canvas_agent_tool_completed",
                            extra={
                                "run_id": run.id,
                                "conversation_id": conversation_id,
                                "canvas_id": conversation.canvas_id,
                                "tool_name": public_event.data["name"],
                                "action_types": [public_event.data["name"]],
                                "status": (
                                    "completed"
                                    if public_event.data["ok"]
                                    else "failed"
                                ),
                            },
                        )
                    yield encode_sse(public_event)
                await _repository(application).finish_run(run.id, "completed")
            except asyncio.CancelledError:
                terminal_status = "cancelled"
                await _repository(application).finish_run(run.id, "cancelled")
                yield encode_sse(
                    StreamEvent(
                        event="run.cancelled",
                        data={"run_id": run.id, "message": "Run cancelled"},
                    )
                )
            except Exception as error:
                terminal_status = "failed"
                error_code = type(error).__name__
                await _repository(application).finish_run(
                    run.id, "failed", error_code=error_code
                )
                logger.exception(
                    "canvas_agent_run_failed",
                    extra={
                        "run_id": run.id,
                        "conversation_id": conversation_id,
                        "canvas_id": conversation.canvas_id,
                        "status": "failed",
                        "error_code": error_code,
                    },
                )
                yield encode_sse(
                    StreamEvent(
                        event="run.failed",
                        data={
                            "run_id": run.id,
                            "code": "agent_error",
                            "message": "The assistant could not complete this turn.",
                            "retryable": True,
                        },
                    )
                )
            finally:
                yield encode_sse(
                    StreamEvent(event="stream.done", data={"run_id": run.id})
                )
                application.state.run_tasks.pop(run.id, None)
                application.state.cancel_events.pop(run.id, None)
                if lock.locked():
                    lock.release()
                logger.info(
                    "canvas_agent_run_completed",
                    extra={
                        "run_id": run.id,
                        "conversation_id": conversation_id,
                        "canvas_id": conversation.canvas_id,
                        "duration_ms": round((monotonic() - started) * 1000),
                        "status": terminal_status,
                        "error_code": error_code,
                    },
                )

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )

    @application.post(
        "/api/runs/{run_id}/cancel", status_code=status.HTTP_202_ACCEPTED
    )
    async def cancel_run(run_id: str) -> Response:
        cancel_event = application.state.cancel_events.get(run_id)
        if cancel_event is None:
            raise HTTPException(status_code=404, detail="Active run not found")
        cancel_event.set()
        return Response(status_code=status.HTTP_202_ACCEPTED)

    return application


def _repository(application: FastAPI) -> ConversationRepository:
    return application.state.repository


def _runtime(application: FastAPI) -> AgentRuntime:
    return application.state.runtime


async def _require_conversation(application: FastAPI, conversation_id: str) -> Any:
    conversation = await _repository(application).get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _public_runtime_event(event: StreamEvent) -> StreamEvent | None:
    if event.event == "assistant.delta":
        return StreamEvent(
            event=event.event,
            data={
                "message_id": event.data["message_id"],
                "text": event.data["delta"],
            },
        )
    if event.event == "assistant.completed":
        return StreamEvent(
            event=event.event,
            data={
                "message": {
                    "id": event.data["message_id"],
                    "role": "assistant",
                    "content": event.data["content"],
                }
            },
        )
    if event.event == "tool.started":
        return StreamEvent(
            event=event.event,
            data={key: event.data[key] for key in ("call_id", "name", "summary")},
        )
    if event.event == "tool.completed":
        return StreamEvent(
            event=event.event,
            data={
                "call_id": event.data["call_id"],
                "name": event.data["name"],
                "ok": event.data["status"] == "success",
                "summary": event.data["summary"],
            },
        )
    return None


app = create_app()

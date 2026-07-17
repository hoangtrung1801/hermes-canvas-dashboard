import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import websockets

from agent_service.models import (
    CanvasActionResult,
    CanvasExecution,
    CanvasObservation,
)


class CanvasSocket(Protocol):
    async def send(self, value: str) -> None: ...

    async def recv(self) -> str: ...

    async def close(self) -> None: ...


class CanvasGatewayError(RuntimeError):
    """The gateway rejected a request or did not return a complete response."""


class CanvasIndeterminateWrite(CanvasGatewayError):
    """A mutation may have reached the gateway before the transport failed."""


Connector = Callable[[str], Awaitable[CanvasSocket]]


class CanvasGatewayClient:
    def __init__(
        self,
        base_url: str,
        timeout_seconds: float = 8,
        retry_count: int = 2,
        connector: Connector = websockets.connect,
        request_id_factory: Callable[[], str] = lambda: f"req_{uuid4().hex}",
    ):
        self.base_url = base_url
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.connector = connector
        self.request_id_factory = request_id_factory

    async def execute(
        self,
        canvas_id: str,
        actions: list[dict[str, Any]],
        *,
        read_only: bool = False,
    ) -> CanvasExecution:
        if not actions:
            raise ValueError("At least one canvas action is required")

        last_error: Exception | None = None
        for attempt in range(self.retry_count + 1):
            socket: CanvasSocket | None = None
            sent = False
            try:
                socket = await self.connector(self._url_for_canvas(canvas_id))
                request_id = self.request_id_factory()
                envelope = {
                    "type": "canvas.action",
                    "requestId": request_id,
                    "canvasId": canvas_id,
                    "actions": actions,
                }
                async with asyncio.timeout(self.timeout_seconds):
                    await socket.send(json.dumps(envelope))
                    sent = True
                    return await self._collect_response(socket, request_id)
            except CanvasGatewayError:
                raise
            except asyncio.CancelledError as error:
                if sent and not read_only:
                    raise CanvasIndeterminateWrite(
                        "Canvas mutation was cancelled after send"
                    ) from error
                raise
            except Exception as error:
                last_error = error
                if sent and not read_only:
                    raise CanvasIndeterminateWrite(
                        "Canvas mutation response was interrupted after send"
                    ) from error
                if attempt >= self.retry_count:
                    break
                await asyncio.sleep(0.1 * (2**attempt))
            finally:
                if socket is not None:
                    await socket.close()

        raise CanvasGatewayError(
            f"Canvas gateway request failed after {self.retry_count + 1} attempts"
        ) from last_error

    async def _collect_response(
        self, socket: CanvasSocket, request_id: str
    ) -> CanvasExecution:
        results: list[CanvasActionResult] | None = None
        observation: CanvasObservation | None = None

        while results is None or observation is None:
            payload = json.loads(await socket.recv())
            if payload.get("requestId") != request_id:
                continue
            message_type = payload.get("type")
            if message_type == "canvas.error":
                raise CanvasGatewayError(str(payload.get("message", "Canvas gateway error")))
            if message_type == "canvas.result":
                results = [CanvasActionResult.model_validate(item) for item in payload["results"]]
            elif message_type == "canvas.observation":
                observation = CanvasObservation.model_validate(payload["state"])

        return CanvasExecution(results=results, observation=observation)

    def _url_for_canvas(self, canvas_id: str) -> str:
        parsed = urlsplit(self.base_url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query.update({"canvasId": canvas_id, "role": "hermes"})
        return urlunsplit(
            (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
        )

#!/usr/bin/env python3
"""CLI helper for sending Hermes canvas action batches."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


VENDOR_DIR = Path(__file__).resolve().parents[3] / "vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))


DEFAULT_CANVAS_ID = "canvas_001"
DEFAULT_TIMEOUT_MS = 5000
DEFAULT_URL = f"ws://localhost:8787/canvas?canvasId={DEFAULT_CANVAS_ID}&role=hermes"


class CanvasDashboardToolError(Exception):
    """Expected user-facing tool error."""


@dataclass(frozen=True)
class ToolConfig:
    url: str
    canvas_id: str
    request_id: str
    timeout_ms: int
    actions: list[dict[str, Any]]


def validate_actions(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise CanvasDashboardToolError("--actions must be a non-empty JSON array")

    actions: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise CanvasDashboardToolError(f"action at index {index} must be an object")

        action_type = item.get("type")
        if not isinstance(action_type, str) or not action_type.strip():
            raise CanvasDashboardToolError(
                f"action at index {index} must include a non-empty string type"
            )

        actions.append(item)

    return actions


def normalize_url(raw_url: str, canvas_id: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"ws", "wss"} or not parsed.netloc:
        raise CanvasDashboardToolError("--url must be a valid ws:// or wss:// URL")

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["canvasId"] = canvas_id
    query["role"] = "hermes"
    return urlunparse(parsed._replace(query=urlencode(query)))


def build_request(
    canvas_id: str, request_id: str, actions: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "type": "canvas.action",
        "requestId": request_id,
        "canvasId": canvas_id,
        "actions": actions,
    }


def is_completion_response(response: dict[str, Any], request_id: str) -> bool:
    return (
        response.get("type") == "canvas.observation"
        and response.get("requestId") == request_id
    )


def format_success(
    request: dict[str, Any], responses: list[dict[str, Any]]
) -> dict[str, Any]:
    return {"ok": True, "request": request, "responses": responses}


def format_failure(
    error: str,
    request: dict[str, Any] | None = None,
    responses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"ok": False, "error": error}
    if request is not None:
        payload["request"] = request
    if responses is not None:
        payload["responses"] = responses
    return payload


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send Hermes canvas action batches to the Canvas Bridge."
    )
    parser.add_argument("--actions", help="JSON array of canvas actions")
    parser.add_argument("--url", help="Canvas gateway WebSocket URL")
    parser.add_argument("--canvasId", help="Canvas id")
    parser.add_argument("--requestId", help="Request id")
    parser.add_argument(
        "--timeoutMs",
        help="Timeout in milliseconds",
    )
    return parser.parse_args(argv)


def parse_config(
    namespace: argparse.Namespace,
    env: dict[str, str] | None = None,
    now_ms: Any | None = None,
) -> ToolConfig:
    env_values = os.environ if env is None else env

    if namespace.actions is None:
        raise CanvasDashboardToolError("--actions is required")

    try:
        parsed_actions = json.loads(namespace.actions)
    except json.JSONDecodeError as error:
        raise CanvasDashboardToolError(
            f"--actions must be valid JSON: {error}"
        ) from error

    actions = validate_actions(parsed_actions)

    timeout_value = namespace.timeoutMs or env_values.get("CANVAS_DASHBOARD_TIMEOUT_MS")
    try:
        timeout_ms = int(timeout_value or DEFAULT_TIMEOUT_MS)
    except ValueError as error:
        raise CanvasDashboardToolError(
            "--timeoutMs must be a positive integer"
        ) from error

    if timeout_ms <= 0:
        raise CanvasDashboardToolError("--timeoutMs must be a positive integer")

    canvas_id = (
        namespace.canvasId
        or env_values.get("CANVAS_DASHBOARD_CANVAS_ID")
        or DEFAULT_CANVAS_ID
    )
    if not isinstance(canvas_id, str) or not canvas_id.strip():
        raise CanvasDashboardToolError("--canvasId must be a non-empty string")

    now = now_ms if now_ms is not None else lambda: int(time.time() * 1000)
    request_id = namespace.requestId or f"req_canvas_dashboard_{now()}"
    if not isinstance(request_id, str) or not request_id.strip():
        raise CanvasDashboardToolError("--requestId must be a non-empty string")

    return ToolConfig(
        url=normalize_url(
            namespace.url or env_values.get("CANVAS_DASHBOARD_URL") or DEFAULT_URL,
            canvas_id,
        ),
        canvas_id=canvas_id,
        request_id=request_id,
        timeout_ms=timeout_ms,
        actions=actions,
    )


def should_fail_for_response(response: dict[str, Any], request_id: str) -> str | None:
    if response.get("type") != "canvas.error" or response.get("requestId") != request_id:
        return None

    message = response.get("message")
    return message if isinstance(message, str) and message else "Canvas bridge returned an error"


def run_bridge_request(config: ToolConfig) -> dict[str, Any]:
    request = build_request(config.canvas_id, config.request_id, config.actions)
    responses: list[dict[str, Any]] = []

    try:
        import websocket
    except ImportError as error:
        raise CanvasDashboardToolError(
            "Missing Python dependency websocket-client. Run with uv, e.g.: "
            "uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions "
            "'[{\"type\":\"read_canvas\"}]' or vendor it once with "
            "uv pip install --target vendor websocket-client"
        ) from error

    try:
        socket = websocket.create_connection(config.url, timeout=config.timeout_ms / 1000)
    except Exception as error:
        raise CanvasDashboardToolError(f"Unable to connect to {config.url}: {error}") from error

    try:
        socket.settimeout(config.timeout_ms / 1000)
        socket.send(json.dumps(request, separators=(",", ":")))
        deadline = time.monotonic() + (config.timeout_ms / 1000)

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CanvasDashboardToolError(
                    f"Timed out after {config.timeout_ms}ms waiting for canvas.observation "
                    f"from {config.url}. Ensure the frontend bridge is connected as role=bridge."
                )

            socket.settimeout(remaining)
            raw_response = socket.recv()

            try:
                response = json.loads(raw_response)
            except json.JSONDecodeError as error:
                raise CanvasDashboardToolError(
                    f"Received invalid JSON from bridge: {error}"
                ) from error

            if not isinstance(response, dict):
                raise CanvasDashboardToolError("Received non-object JSON from bridge")

            responses.append(response)

            bridge_error = should_fail_for_response(response, config.request_id)
            if bridge_error:
                return format_failure(bridge_error, request, responses)

            if is_completion_response(response, config.request_id):
                return format_success(request, responses)
    except CanvasDashboardToolError:
        raise
    except Exception as error:
        raise CanvasDashboardToolError(f"WebSocket error from {config.url}: {error}") from error
    finally:
        socket.close()


def main(argv: list[str] | None = None) -> int:
    request: dict[str, Any] | None = None
    responses: list[dict[str, Any]] = []

    try:
        config = parse_config(parse_args(sys.argv[1:] if argv is None else argv))
        request = build_request(config.canvas_id, config.request_id, config.actions)
        result = run_bridge_request(config)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result.get("ok") is True else 1
    except CanvasDashboardToolError as error:
        print(json.dumps(format_failure(str(error), request, responses), indent=2, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

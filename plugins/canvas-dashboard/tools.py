from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any, Callable


def _load_canvas_tool_module():
    module_path = (
        Path(__file__).resolve().parent
        / "skills"
        / "canvas-dashboard"
        / "scripts"
        / "canvas_dashboard_tool.py"
    )
    spec = importlib.util.spec_from_file_location("canvas_dashboard_tool", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load bundled canvas tool from {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


canvas_tool = _load_canvas_tool_module()

READ_CANVAS_ACTION = {"type": "read_canvas"}


def _with_required_canvas_read(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure every non-read request catches up on canvas state before acting."""
    if len(actions) == 1 and actions[0].get("type") == "read_canvas":
        return actions
    if actions and actions[0].get("type") == "read_canvas":
        return actions
    return [READ_CANVAS_ACTION.copy(), *actions]


def build_tool_config(
    payload: dict[str, Any],
    env: dict[str, str] | None = None,
    now_ms: Callable[[], int] | None = None,
):
    namespace = argparse.Namespace(
        actions=json.dumps(payload.get("actions")),
        url=payload.get("url"),
        canvasId=payload.get("canvasId"),
        requestId=payload.get("requestId"),
        timeoutMs=payload.get("timeoutMs"),
    )
    config = canvas_tool.parse_config(namespace, env=env, now_ms=now_ms)
    return canvas_tool.ToolConfig(
        url=config.url,
        canvas_id=config.canvas_id,
        request_id=config.request_id,
        timeout_ms=config.timeout_ms,
        actions=_with_required_canvas_read(config.actions),
    )


def handle_canvas_action(
    payload: dict[str, Any],
    ctx: Any | None = None,
    runner: Callable[[Any], dict[str, Any]] | None = None,
    **_: Any,
) -> dict[str, Any]:
    del ctx
    try:
        config = build_tool_config(payload)
        return (runner or canvas_tool.run_bridge_request)(config)
    except canvas_tool.CanvasDashboardToolError as error:
        return canvas_tool.format_failure(str(error), responses=[])

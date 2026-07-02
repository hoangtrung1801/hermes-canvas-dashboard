# Canvas Dashboard Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-local `canvas-dashboard` operational skill and a Python CLI that lets Hermes send machine-readable action batches through the existing Canvas Bridge.

**Architecture:** Keep the bridge protocol unchanged. Add one Python CLI under `skills/canvas-dashboard/` with small, testable helper functions and lazy WebSocket dependency loading. Add one repo-local skill under `skills/canvas-dashboard/` that documents full Canvas API usage and points agents at the CLI.

**Tech Stack:** Python 3 standard library, optional `websocket-client`, `unittest`, existing Node/Vite/TypeScript bridge.

---

## File Structure

- Create `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py`
  Python CLI and testable helper functions for parsing args, normalizing URLs, validating action arrays, building request envelopes, collecting matching responses, and printing stable JSON.
- Create `skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py`
  Standard-library `unittest` tests for the Python helper functions. Tests must not open a WebSocket connection.
- Create `skills/canvas-dashboard/SKILL.md`
  Agent-facing operational skill covering startup requirements, CLI usage, response handling, all current Canvas API actions, batch examples, and troubleshooting.

## Task 1: Add Python Tool Helper Tests

**Files:**
- Create: `skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py`
- Create: `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py`

- [ ] **Step 1: Create a minimal importable Python module**

Create `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py` with enough symbols for tests to import:

```python
#!/usr/bin/env python3
"""CLI helper for sending Hermes canvas action batches."""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


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


def build_request(canvas_id: str, request_id: str, actions: list[dict[str, Any]]) -> dict[str, Any]:
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


def format_success(request: dict[str, Any], responses: list[dict[str, Any]]) -> dict[str, Any]:
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
```

- [ ] **Step 2: Write failing unit tests**

Create `skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py`:

```python
import unittest

from canvas_dashboard_tool import (
    CanvasDashboardToolError,
    build_request,
    format_failure,
    format_success,
    is_completion_response,
    normalize_url,
    validate_actions,
)


class CanvasDashboardToolTests(unittest.TestCase):
    def test_validate_actions_accepts_non_empty_action_objects(self):
        actions = validate_actions([{"type": "read_canvas"}])

        self.assertEqual(actions, [{"type": "read_canvas"}])

    def test_validate_actions_rejects_empty_list(self):
        with self.assertRaisesRegex(CanvasDashboardToolError, "non-empty JSON array"):
            validate_actions([])

    def test_validate_actions_rejects_missing_type(self):
        with self.assertRaisesRegex(CanvasDashboardToolError, "index 0"):
            validate_actions([{"text": "missing type"}])

    def test_normalize_url_sets_canvas_id_and_hermes_role(self):
        url = normalize_url(
            "ws://localhost:8787/canvas?canvasId=old&role=bridge&keep=yes",
            "canvas_002",
        )

        self.assertEqual(
            url,
            "ws://localhost:8787/canvas?canvasId=canvas_002&role=hermes&keep=yes",
        )

    def test_normalize_url_rejects_http_url(self):
        with self.assertRaisesRegex(CanvasDashboardToolError, "ws:// or wss://"):
            normalize_url("http://localhost:8787/canvas", "canvas_001")

    def test_build_request_uses_canvas_action_envelope(self):
        request = build_request("canvas_001", "req_123", [{"type": "read_canvas"}])

        self.assertEqual(
            request,
            {
                "type": "canvas.action",
                "requestId": "req_123",
                "canvasId": "canvas_001",
                "actions": [{"type": "read_canvas"}],
            },
        )

    def test_completion_response_matches_observation_and_request_id(self):
        self.assertTrue(
            is_completion_response(
                {"type": "canvas.observation", "requestId": "req_123"},
                "req_123",
            )
        )
        self.assertFalse(
            is_completion_response(
                {"type": "canvas.result", "requestId": "req_123"},
                "req_123",
            )
        )

    def test_format_success_is_stable_json_shape(self):
        request = {"type": "canvas.action", "requestId": "req_123"}
        responses = [{"type": "canvas.result", "requestId": "req_123"}]

        self.assertEqual(
            format_success(request, responses),
            {"ok": True, "request": request, "responses": responses},
        )

    def test_format_failure_includes_request_and_responses_when_present(self):
        request = {"type": "canvas.action", "requestId": "req_123"}
        responses = [{"type": "canvas.error", "requestId": "req_123"}]

        self.assertEqual(
            format_failure("failed", request, responses),
            {"ok": False, "error": "failed", "request": request, "responses": responses},
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run tests to verify helper behavior**

Run:

```bash
python3 -m unittest skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
```

Expected: PASS for helper tests.

- [ ] **Step 4: Commit helper tests and importable skeleton**

```bash
git add skills/canvas-dashboard/scripts/canvas_dashboard_tool.py skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
git commit -m "test: add canvas dashboard python tool coverage"
```

## Task 2: Implement Python CLI Runtime

**Files:**
- Modify: `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py`
- Test: `skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py`

- [ ] **Step 1: Extend tests for argument parsing and bridge error detection**

Add these tests to `CanvasDashboardToolTests`:

```python
from canvas_dashboard_tool import parse_args, parse_config, should_fail_for_response


class CanvasDashboardToolTests(unittest.TestCase):
    def test_parse_config_uses_defaults_and_generated_request_id(self):
        namespace = parse_args(["--actions", '[{"type":"read_canvas"}]'])
        config = parse_config(namespace, now_ms=lambda: 12345)

        self.assertEqual(config.canvas_id, "canvas_001")
        self.assertEqual(config.timeout_ms, 5000)
        self.assertEqual(config.request_id, "req_canvas_dashboard_12345")
        self.assertEqual(
            config.url,
            "ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes",
        )
        self.assertEqual(config.actions, [{"type": "read_canvas"}])

    def test_parse_config_rejects_invalid_json(self):
        namespace = parse_args(["--actions", "not-json"])

        with self.assertRaisesRegex(CanvasDashboardToolError, "valid JSON"):
            parse_config(namespace, now_ms=lambda: 12345)

    def test_parse_config_rejects_invalid_timeout(self):
        namespace = parse_args(["--actions", '[{"type":"read_canvas"}]', "--timeoutMs", "0"])

        with self.assertRaisesRegex(CanvasDashboardToolError, "positive integer"):
            parse_config(namespace, now_ms=lambda: 12345)

    def test_should_fail_for_matching_canvas_error(self):
        response = {
            "type": "canvas.error",
            "requestId": "req_123",
            "message": "Invalid Hermes message",
        }

        self.assertEqual(should_fail_for_response(response, "req_123"), "Invalid Hermes message")
        self.assertIsNone(should_fail_for_response(response, "req_other"))
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
python3 -m unittest skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
```

Expected: FAIL because `parse_args`, `parse_config`, and `should_fail_for_response` are not implemented yet.

- [ ] **Step 3: Implement CLI parsing, WebSocket execution, and main**

Append and integrate this code in `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py`:

```python
def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send Hermes canvas action batches to the Canvas Bridge."
    )
    parser.add_argument("--actions", required=True, help="JSON array of canvas actions")
    parser.add_argument("--url", default=DEFAULT_URL, help="Canvas gateway WebSocket URL")
    parser.add_argument("--canvasId", default=DEFAULT_CANVAS_ID, help="Canvas id")
    parser.add_argument("--requestId", help="Request id")
    parser.add_argument(
        "--timeoutMs",
        default=str(DEFAULT_TIMEOUT_MS),
        help="Timeout in milliseconds",
    )
    return parser.parse_args(argv)


def parse_config(
    namespace: argparse.Namespace,
    now_ms: Any | None = None,
) -> ToolConfig:
    try:
        parsed_actions = json.loads(namespace.actions)
    except json.JSONDecodeError as error:
        raise CanvasDashboardToolError(f"--actions must be valid JSON: {error}") from error

    actions = validate_actions(parsed_actions)

    try:
        timeout_ms = int(namespace.timeoutMs)
    except ValueError as error:
        raise CanvasDashboardToolError("--timeoutMs must be a positive integer") from error

    if timeout_ms <= 0:
        raise CanvasDashboardToolError("--timeoutMs must be a positive integer")

    canvas_id = namespace.canvasId
    if not isinstance(canvas_id, str) or not canvas_id.strip():
        raise CanvasDashboardToolError("--canvasId must be a non-empty string")

    now = now_ms if now_ms is not None else lambda: int(time.time() * 1000)
    request_id = namespace.requestId or f"req_canvas_dashboard_{now()}"
    if not isinstance(request_id, str) or not request_id.strip():
        raise CanvasDashboardToolError("--requestId must be a non-empty string")

    return ToolConfig(
        url=normalize_url(namespace.url, canvas_id),
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
            "Missing Python dependency websocket-client. Install it with: "
            "python3 -m pip install websocket-client"
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
                raise CanvasDashboardToolError(f"Received invalid JSON from bridge: {error}") from error
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
```

- [ ] **Step 4: Run Python unit tests**

Run:

```bash
python3 -m unittest skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
```

Expected: PASS.

- [ ] **Step 5: Run no-server failure smoke test**

Run:

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]' --timeoutMs 100
```

Expected: exits non-zero and prints one JSON object with `"ok": false`. If no `websocket-client` package is installed, the error should explain the install command.

- [ ] **Step 6: Commit Python CLI runtime**

```bash
git add skills/canvas-dashboard/scripts/canvas_dashboard_tool.py skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
git commit -m "feat: add canvas dashboard python tool"
```

## Task 3: Add Canvas Dashboard Skill

**Files:**
- Create: `skills/canvas-dashboard/SKILL.md`

- [ ] **Step 1: Create the skill document**

Create `skills/canvas-dashboard/SKILL.md`:

````markdown
---
name: canvas-dashboard
description: Operate the Hermes Canvas Bridge from an agent workflow using the repo-local Python canvas dashboard tool.
---

# Canvas Dashboard

Use this skill when Hermes needs to read or write the existing Canvas Bridge workspace. This skill is for operations only: send actions, read observations, inspect results, and recover from bridge errors. Do not use it for designing or extending UI.

## Prerequisites

From the repository root, the gateway must be running:

```bash
npm run server
```

The browser canvas must also be open with the frontend connected as `role=bridge`, for example:

```bash
VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev
```

Install the Python WebSocket dependency once if it is missing:

```bash
python3 -m pip install websocket-client
```

## Tool Command

Send actions with:

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

Useful options:

- `--actions`: required JSON array of Canvas API actions.
- `--url`: gateway WebSocket URL. Defaults to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
- `--canvasId`: canvas id. Defaults to `canvas_001`.
- `--requestId`: stable request id for correlation.
- `--timeoutMs`: timeout in milliseconds. Defaults to `5000`.

The tool prints a single JSON object. On success, `ok` is `true` and `responses` contains the received `canvas.result` and `canvas.observation` envelopes. On failure, `ok` is `false` and `error` explains the failure.

## Response Handling

Read `canvas.result.results[]` for per-action ids and errors. Read the following `canvas.observation.state.blocks[]` for the current canvas state. Use returned `createdBlockIds`, `matchedBlockIds`, and task ids for follow-up actions.

Stop and inspect the JSON if:

- The tool exits non-zero.
- `ok` is `false`.
- Any result item contains `error`.
- A `canvas.error` envelope appears.

## Actions

### create_text

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Hello from Hermes","x":100,"y":120,"name":"Greeting"}]'
```

### create_box

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Container","text":"Planning area","x":80,"y":80,"w":650,"h":420}]'
```

### create_note

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_note","text":"Architecture note","x":450,"y":150,"name":"Note"}]'
```

### create_todo_block

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_todo_block","name":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true},"Ship release"],"props":{"priority":"high"}}]'
```

### create_task_card

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","name":"Design import modal","text":"Create modern modal UI","x":100,"y":120,"props":{"status":"todo","priority":"medium","assignee":"Hermes"}}]'
```

### create_link_card

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_link_card","name":"Excalidraw Documentation","url":"https://docs.excalidraw.com","x":100,"y":350,"props":{"category":"docs"}}]'
```

### create_arrow

Use block ids returned by previous create or lookup actions.

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_arrow","fromBlockId":"block_0001","toBlockId":"block_0002","label":"depends on"}]'
```

### update_text

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"update_text","blockId":"block_0001","text":"Updated text"}]'
```

### append_todo_task

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"append_todo_task","blockId":"block_0001","taskId":"task_review","text":"Review implementation"}]'
```

### set_todo_task_done

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"set_todo_task_done","blockId":"block_0001","taskId":"task_review","done":true}]'
```

### remove_todo_task

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"remove_todo_task","blockId":"block_0001","taskId":"task_review"}]'
```

### move_block

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"move_block","blockId":"block_0001","x":240,"y":320}]'
```

### delete_block

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"delete_block","blockId":"block_0001"}]'
```

### get_block_by_name

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"get_block_by_name","name":"Launch Checklist"}]'
```

### get_todo_block_data

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"get_todo_block_data","blockId":"block_0001"}]'
```

### read_canvas

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

### zoom_to_fit

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"zoom_to_fit"}]'
```

## Batch Example

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Plan","text":"Dashboard plan","x":80,"y":80,"w":500,"h":280},{"type":"create_todo_block","name":"Next Steps","x":120,"y":150,"tasks":["Read current canvas","Update task status"]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Source of Truth

Use `CANVAS_API.md` for exact protocol and action schemas. The Python tool does lightweight preflight validation only; the bridge performs authoritative validation.

## Troubleshooting

- `Missing Python dependency websocket-client`: run `python3 -m pip install websocket-client`.
- `Unable to connect`: start `npm run server` and check `--url`.
- Timeout waiting for `canvas.observation`: open the frontend with `role=bridge`.
- `canvas.error`: fix the action payload according to `CANVAS_API.md`.
- Result item contains `error`: the envelope was valid, but that action failed; inspect ids and block types.
````

- [ ] **Step 2: Verify all actions are documented**

Run:

```bash
rg -n "### (create_text|create_box|create_note|create_todo_block|create_task_card|create_link_card|create_arrow|update_text|append_todo_task|set_todo_task_done|remove_todo_task|move_block|delete_block|get_block_by_name|get_todo_block_data|read_canvas|zoom_to_fit)" skills/canvas-dashboard/SKILL.md
```

Expected: output includes one heading for each of the 17 current actions.

- [ ] **Step 3: Commit skill document**

```bash
git add skills/canvas-dashboard/SKILL.md
git commit -m "docs: add canvas dashboard skill"
```

## Task 4: Final Verification

**Files:**
- Verify: `skills/canvas-dashboard/scripts/canvas_dashboard_tool.py`
- Verify: `skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py`
- Verify: `skills/canvas-dashboard/SKILL.md`

- [ ] **Step 1: Run Python unit tests**

Run:

```bash
python3 -m unittest skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript tests to catch unrelated protocol regressions**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run type check**

Run:

```bash
npm run lint:types
```

Expected: PASS.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: clean worktree.

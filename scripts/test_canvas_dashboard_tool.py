import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from canvas_dashboard_tool import (
    CanvasDashboardToolError,
    build_request,
    format_failure,
    format_success,
    is_completion_response,
    normalize_url,
    parse_args,
    parse_config,
    should_fail_for_response,
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

    def test_parse_config_rejects_missing_actions(self):
        namespace = parse_args([])

        with self.assertRaisesRegex(CanvasDashboardToolError, "required"):
            parse_config(namespace, now_ms=lambda: 12345)

    def test_parse_config_rejects_invalid_timeout(self):
        namespace = parse_args(
            ["--actions", '[{"type":"read_canvas"}]', "--timeoutMs", "0"]
        )

        with self.assertRaisesRegex(CanvasDashboardToolError, "positive integer"):
            parse_config(namespace, now_ms=lambda: 12345)

    def test_should_fail_for_matching_canvas_error(self):
        response = {
            "type": "canvas.error",
            "requestId": "req_123",
            "message": "Invalid Hermes message",
        }

        self.assertEqual(
            should_fail_for_response(response, "req_123"), "Invalid Hermes message"
        )
        self.assertIsNone(should_fail_for_response(response, "req_other"))


if __name__ == "__main__":
    unittest.main()

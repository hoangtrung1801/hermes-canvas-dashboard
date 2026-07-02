import unittest
from importlib import util
from pathlib import Path

from tools import build_tool_config, handle_canvas_action


def load_plugin_entrypoint():
    module_path = Path(__file__).resolve().parent / "__init__.py"
    spec = util.spec_from_file_location("canvas_dashboard_plugin", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load plugin entrypoint")
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self):
        self.tools = []
        self.skills = []

    def register_tool(self, **kwargs):
        self.tools.append(kwargs)

    def register_skill(self, **kwargs):
        self.skills.append(kwargs)


class CanvasDashboardPluginTests(unittest.TestCase):
    def test_register_adds_tool_and_skill(self):
        ctx = FakeContext()
        plugin = load_plugin_entrypoint()

        plugin.register(ctx)

        self.assertEqual(ctx.tools[0]["name"], "canvas_action")
        self.assertEqual(ctx.tools[0]["toolset"], "canvas_dashboard")
        self.assertEqual(ctx.skills[0]["name"], "canvas-dashboard")
        self.assertTrue(ctx.skills[0]["path"].endswith("skills/canvas-dashboard"))

    def test_build_tool_config_uses_payload_over_environment(self):
        config = build_tool_config(
            {
                "actions": [{"type": "read_canvas"}],
                "url": "ws://localhost:8787/canvas?canvasId=old&role=bridge",
                "canvasId": "cli_canvas",
                "requestId": "req_plugin",
                "timeoutMs": 3000,
            },
            env={
                "CANVAS_DASHBOARD_URL": "wss://canvas.example/ws?canvasId=env&role=bridge",
                "CANVAS_DASHBOARD_CANVAS_ID": "env_canvas",
                "CANVAS_DASHBOARD_TIMEOUT_MS": "9000",
            },
        )

        self.assertEqual(config.canvas_id, "cli_canvas")
        self.assertEqual(config.request_id, "req_plugin")
        self.assertEqual(config.timeout_ms, 3000)
        self.assertEqual(
            config.url,
            "ws://localhost:8787/canvas?canvasId=cli_canvas&role=hermes",
        )
        self.assertEqual(config.actions, [{"type": "read_canvas"}])

    def test_build_tool_config_uses_environment_defaults(self):
        config = build_tool_config(
            {"actions": [{"type": "read_canvas"}]},
            env={
                "CANVAS_DASHBOARD_URL": "wss://canvas.example/ws?canvasId=old&role=bridge",
                "CANVAS_DASHBOARD_CANVAS_ID": "env_canvas",
                "CANVAS_DASHBOARD_TIMEOUT_MS": "9000",
            },
            now_ms=lambda: 42,
        )

        self.assertEqual(config.canvas_id, "env_canvas")
        self.assertEqual(config.request_id, "req_canvas_dashboard_42")
        self.assertEqual(config.timeout_ms, 9000)
        self.assertEqual(
            config.url,
            "wss://canvas.example/ws?canvasId=env_canvas&role=hermes",
        )

    def test_handle_canvas_action_returns_runner_result(self):
        def fake_runner(config):
            return {
                "ok": True,
                "request": {
                    "type": "canvas.action",
                    "requestId": config.request_id,
                    "canvasId": config.canvas_id,
                    "actions": config.actions,
                },
                "responses": [],
            }

        result = handle_canvas_action(
            {"actions": [{"type": "read_canvas"}], "requestId": "req_plugin"},
            runner=fake_runner,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["request"]["requestId"], "req_plugin")
        self.assertEqual(result["request"]["actions"], [{"type": "read_canvas"}])

    def test_handle_canvas_action_returns_structured_validation_error(self):
        result = handle_canvas_action({"actions": []})

        self.assertFalse(result["ok"])
        self.assertIn("non-empty JSON array", result["error"])


if __name__ == "__main__":
    unittest.main()

import os
import tempfile
import types
import sys
import unittest
from importlib import util
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent
if str(PLUGIN_DIR) not in sys.path:
    sys.path.insert(0, str(PLUGIN_DIR))

from tools import build_tool_config, handle_canvas_action


def load_plugin_entrypoint():
    module_path = Path(__file__).resolve().parent / "__init__.py"
    spec = util.spec_from_file_location(
        "hermes_plugins.canvas_dashboard",
        module_path,
        submodule_search_locations=[str(module_path.parent)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load plugin entrypoint")
    if "hermes_plugins" not in sys.modules:
        parent = types.ModuleType("hermes_plugins")
        parent.__path__ = []
        parent.__package__ = "hermes_plugins"
        sys.modules["hermes_plugins"] = parent
    module = util.module_from_spec(spec)
    module.__package__ = "hermes_plugins.canvas_dashboard"
    module.__path__ = [str(module_path.parent)]
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self):
        self.tools = []
        self.skills = []
        self.hooks = []

    def register_tool(self, **kwargs):
        self.tools.append(kwargs)

    def register_skill(self, **kwargs):
        self.skills.append(kwargs)

    def register_hook(self, name, callback):
        self.hooks.append((name, callback))


class CanvasDashboardPluginTests(unittest.TestCase):
    def test_register_adds_tool_and_hook_and_installs_skill(self):
        ctx = FakeContext()
        plugin = load_plugin_entrypoint()

        with tempfile.TemporaryDirectory() as tmp_home:
            previous_home = os.environ.get("HERMES_HOME")
            os.environ["HERMES_HOME"] = tmp_home
            try:
                plugin.register(ctx)
            finally:
                if previous_home is None:
                    os.environ.pop("HERMES_HOME", None)
                else:
                    os.environ["HERMES_HOME"] = previous_home

            installed_skill = (
                Path(tmp_home)
                / "skills"
                / "productivity"
                / "canvas-dashboard"
                / "SKILL.md"
            )
            self.assertTrue(installed_skill.exists())

        self.assertEqual(ctx.tools[0]["name"], "canvas_action")
        self.assertEqual(ctx.tools[0]["toolset"], "canvas_dashboard")
        self.assertEqual(ctx.skills, [])
        self.assertEqual(ctx.hooks[0][0], "pre_llm_call")

    def test_pre_llm_call_returns_canvas_routing_hint_for_task_message(self):
        plugin = load_plugin_entrypoint()
        context = plugin._pre_llm_call(user_message="add task 'undo thing 3'")
        self.assertIn("Load the `canvas-dashboard` skill", context["context"])
        self.assertIn("canvas_action", context["context"])
        self.assertIn("session `todo` tool", context["context"])

    def test_pre_llm_call_ignores_unrelated_message(self):
        plugin = load_plugin_entrypoint()
        self.assertIsNone(plugin._pre_llm_call(user_message="what is the capital of France?"))

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

    def test_build_tool_config_keeps_read_only_action_single(self):
        config = build_tool_config({"actions": [{"type": "read_canvas"}]})

        self.assertEqual(config.actions, [{"type": "read_canvas"}])

    def test_build_tool_config_prepends_read_canvas_before_non_read_actions(self):
        config = build_tool_config(
            {"actions": [{"type": "create_text", "text": "Hello"}]}
        )

        self.assertEqual(
            config.actions,
            [{"type": "read_canvas"}, {"type": "create_text", "text": "Hello"}],
        )

    def test_build_tool_config_does_not_duplicate_existing_leading_read_canvas(self):
        config = build_tool_config(
            {
                "actions": [
                    {"type": "read_canvas"},
                    {"type": "create_text", "text": "Hello"},
                ]
            }
        )

        self.assertEqual(
            config.actions,
            [{"type": "read_canvas"}, {"type": "create_text", "text": "Hello"}],
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
            {
                "actions": [{"type": "create_text", "text": "Hello"}],
                "requestId": "req_plugin",
            },
            runner=fake_runner,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["request"]["requestId"], "req_plugin")
        self.assertEqual(
            result["request"]["actions"],
            [{"type": "read_canvas"}, {"type": "create_text", "text": "Hello"}],
        )

    def test_handle_canvas_action_returns_structured_validation_error(self):
        result = handle_canvas_action({"actions": []})

        self.assertFalse(result["ok"])
        self.assertIn("non-empty JSON array", result["error"])


if __name__ == "__main__":
    unittest.main()

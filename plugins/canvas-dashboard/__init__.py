from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from .schemas import CANVAS_ACTION_SCHEMA
from .tools import handle_canvas_action

logger = logging.getLogger(__name__)

_CANVAS_DASHBOARD_CONTEXT = """Canvas Dashboard plugin hint:
This request appears to target the Canvas Dashboard. Load the `canvas-dashboard` skill before acting and prefer the Canvas Bridge API through the `canvas_action` tool instead of Hermes's session `todo` tool unless the user explicitly asks for the in-session todo list. Read canvas state before changes and verify changes from the returned canvas observation. If `canvas-dashboard` is unavailable, load `canvas-dashboard-operations` as the fallback skill."""

_CANVAS_TRIGGER_RE = re.compile(
    r"(?:\bcanvas\b|\bdashboard\b|\btodo\b|\btask\b|\bchecklist\b|\bnote\b|\bcard\b|\bblock\b|\barrow\b)",
    re.IGNORECASE,
)


def _hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))


def _bundled_skill_path() -> Path:
    return Path(__file__).resolve().parent / "skills" / "canvas-dashboard" / "SKILL.md"


def _installed_skill_path() -> Path:
    return _hermes_home() / "skills" / "productivity" / "canvas-dashboard" / "SKILL.md"


def _install_bundled_skill() -> None:
    src = _bundled_skill_path()
    dst = _installed_skill_path()

    if not src.exists():
        logger.warning("Canvas Dashboard bundled skill missing at %s", src)
        return

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        src_text = src.read_text(encoding="utf-8")
        if dst.exists() and dst.read_text(encoding="utf-8") == src_text:
            return
        dst.write_text(src_text, encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed to install bundled canvas-dashboard skill: %s", exc)


def _pre_llm_call(**kwargs):
    user_message = kwargs.get("user_message")
    if not isinstance(user_message, str) or not user_message.strip():
        return None
    if not _CANVAS_TRIGGER_RE.search(user_message):
        return None
    return {"context": _CANVAS_DASHBOARD_CONTEXT}



def register(ctx):
    _install_bundled_skill()
    ctx.register_tool(
        name="canvas_action",
        toolset="canvas_dashboard",
        schema=CANVAS_ACTION_SCHEMA,
        handler=handle_canvas_action,
        description="Send canvas.action batches to a running Canvas Dashboard API.",
    )
    ctx.register_hook("pre_llm_call", _pre_llm_call)

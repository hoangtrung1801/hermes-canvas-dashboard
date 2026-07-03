from __future__ import annotations

from .schemas import CANVAS_ACTION_SCHEMA
from .tools import handle_canvas_action


def register(ctx):
    ctx.register_tool(
        name="canvas_action",
        toolset="canvas_dashboard",
        schema=CANVAS_ACTION_SCHEMA,
        handler=handle_canvas_action,
        description="Send canvas.action batches to a running Canvas Dashboard API.",
    )

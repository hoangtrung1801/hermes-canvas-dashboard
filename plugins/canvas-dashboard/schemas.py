CANVAS_ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "actions": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "minLength": 1},
                },
                "required": ["type"],
                "additionalProperties": True,
            },
            "description": "Canvas action objects to send in one canvas.action batch. The plugin automatically prepends read_canvas before any non-read action so Hermes catches up on current canvas state first.",
        },
        "url": {
            "type": "string",
            "description": "Optional Canvas Dashboard WebSocket URL. Overrides CANVAS_DASHBOARD_URL.",
        },
        "canvasId": {
            "type": "string",
            "description": "Optional canvas id. Overrides CANVAS_DASHBOARD_CANVAS_ID.",
        },
        "requestId": {
            "type": "string",
            "description": "Optional request id for response correlation.",
        },
        "timeoutMs": {
            "type": "integer",
            "minimum": 1,
            "description": "Optional timeout in milliseconds. Overrides CANVAS_DASHBOARD_TIMEOUT_MS.",
        },
    },
    "required": ["actions"],
    "additionalProperties": False,
}

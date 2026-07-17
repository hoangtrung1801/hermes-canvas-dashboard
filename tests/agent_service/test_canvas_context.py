import pytest

from agent_service.canvas_context import arrange_positions, summarize_canvas
from agent_service.models import CanvasObservation


def observation() -> CanvasObservation:
    return CanvasObservation.model_validate(
        {
            "canvasId": "canvas_001",
            "pageId": "page:page",
            "selectedShapeIds": ["shape:b"],
            "camera": {"x": 0, "y": 0, "z": 1},
            "viewportPageBounds": {"x": 0, "y": 0, "w": 250, "h": 200},
            "shapes": [
                {
                    "id": "shape:a",
                    "type": "geo",
                    "x": 20,
                    "y": 30,
                    "props": {"w": 100, "h": 80, "richText": "A"},
                    "meta": {},
                },
                {
                    "id": "shape:b",
                    "type": "todo_block",
                    "x": 300,
                    "y": 30,
                    "props": {
                        "w": 200,
                        "h": 120,
                        "title": "Launch",
                        "tasks": [{"id": "task:1", "text": "Ship", "done": False}],
                    },
                    "meta": {},
                },
                {
                    "id": "shape:c",
                    "type": "geo",
                    "x": 900,
                    "y": 900,
                    "props": {"w": 100, "h": 80, "richText": "C"},
                    "meta": {},
                },
            ],
        }
    )


def test_summary_keeps_ids_selection_and_custom_task_ids():
    text = summarize_canvas(observation(), max_chars=2000)

    assert "selected: shape:b" in text
    assert "task:1" in text
    assert text.index('"id":"shape:b"') < text.index('"id":"shape:a"')
    assert text.index('"id":"shape:a"') < text.index('"id":"shape:c"')


def test_summary_truncates_long_content_before_shape_ids():
    state = observation()
    state.shapes[0].props["content"] = "x" * 5000

    text = summarize_canvas(state, max_chars=900)

    assert len(text) <= 900
    assert "[canvas context truncated]" in text
    assert all(shape.id in text for shape in state.shapes)


def test_grid_positions_are_stable():
    positions = arrange_positions(
        observation(),
        ["shape:a", "shape:b"],
        layout="grid",
        columns=2,
        gap=20,
        origin_x=0,
        origin_y=0,
    )

    assert positions == {"shape:a": (0, 0), "shape:b": (120, 0)}


def test_arrangement_rejects_unknown_and_duplicate_ids():
    with pytest.raises(ValueError, match="Unknown shape"):
        arrange_positions(observation(), ["shape:missing"], layout="row")
    with pytest.raises(ValueError, match="Duplicate shape"):
        arrange_positions(observation(), ["shape:a", "shape:a"], layout="row")

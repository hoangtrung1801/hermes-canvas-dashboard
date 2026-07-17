import pytest

from agent_service.models import CanvasExecution


@pytest.fixture
def empty_execution() -> CanvasExecution:
    return CanvasExecution.model_validate(
        {
            "results": [{"actionType": "read_canvas"}],
            "observation": {
                "canvasId": "canvas_001",
                "pageId": "page:page",
                "selectedShapeIds": [],
                "camera": {"x": 0, "y": 0, "z": 1},
                "shapes": [],
            },
        }
    )


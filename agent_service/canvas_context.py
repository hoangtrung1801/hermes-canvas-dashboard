import json
from typing import Any, Literal

from agent_service.models import CanvasObservation, CanvasShape, CanvasViewport

SEMANTIC_PROPS = (
    "title",
    "name",
    "text",
    "richText",
    "content",
    "description",
    "url",
    "tasks",
    "geo",
    "color",
    "size",
    "w",
    "h",
)


def summarize_canvas(observation: CanvasObservation, max_chars: int) -> str:
    ordered_shapes = _ordered_shapes(observation)
    header = _summary_header(observation)
    full_lines = [_shape_line(shape, string_limit=None) for shape in ordered_shapes]
    full_summary = "\n".join([header, "shapes:", *full_lines])
    if len(full_summary) <= max_chars:
        return full_summary

    compact_lines = [_shape_line(shape, string_limit=120) for shape in ordered_shapes]
    marker = "[canvas context truncated]"
    compact_summary = "\n".join([header, "shapes:", *compact_lines, marker])
    if len(compact_summary) <= max_chars:
        return compact_summary

    minimal_lines = [
        json.dumps(
            {
                "id": shape.id,
                "type": shape.type,
                "x": shape.x,
                "y": shape.y,
                "w": _shape_width(shape),
                "h": _shape_height(shape),
            },
            separators=(",", ":"),
            ensure_ascii=False,
        )
        for shape in ordered_shapes
    ]
    minimal_summary = "\n".join([header, "shapes:", *minimal_lines, marker])
    if len(minimal_summary) <= max_chars:
        return minimal_summary

    ids_only = "shape_ids: " + ", ".join(shape.id for shape in ordered_shapes)
    result = "\n".join([header, ids_only, marker])
    return result if len(result) <= max_chars else result[:max_chars]


def arrange_positions(
    observation: CanvasObservation,
    shape_ids: list[str],
    *,
    layout: Literal["row", "column", "grid"],
    columns: int = 3,
    gap: float = 32,
    origin_x: float | None = None,
    origin_y: float | None = None,
) -> dict[str, tuple[float, float]]:
    if len(shape_ids) != len(set(shape_ids)):
        raise ValueError("Duplicate shape IDs are not allowed")
    if not shape_ids:
        return {}
    if columns < 1:
        raise ValueError("columns must be at least 1")
    if gap < 0:
        raise ValueError("gap must be non-negative")

    by_id = {shape.id: shape for shape in observation.shapes}
    missing = next((shape_id for shape_id in shape_ids if shape_id not in by_id), None)
    if missing:
        raise ValueError(f"Unknown shape {missing}")
    shapes = [by_id[shape_id] for shape_id in shape_ids]
    start_x = origin_x if origin_x is not None else min(shape.x for shape in shapes)
    start_y = origin_y if origin_y is not None else min(shape.y for shape in shapes)

    if layout == "row":
        return _row_positions(shapes, start_x, start_y, gap)
    if layout == "column":
        return _column_positions(shapes, start_x, start_y, gap)
    if layout != "grid":
        raise ValueError(f"Unknown layout {layout}")
    return _grid_positions(shapes, start_x, start_y, gap, columns)


def _summary_header(observation: CanvasObservation) -> str:
    camera = observation.camera
    viewport = observation.viewport_page_bounds
    selected = ", ".join(observation.selected_shape_ids) or "none"
    lines = [
        f"canvas: {observation.canvas_id}",
        f"page: {observation.page_id}",
        f"camera: x={camera.x:g} y={camera.y:g} z={camera.z:g}",
        f"selected: {selected}",
    ]
    if viewport:
        lines.append(
            f"viewport: x={viewport.x:g} y={viewport.y:g} w={viewport.w:g} h={viewport.h:g}"
        )
    return "\n".join(lines)


def _ordered_shapes(observation: CanvasObservation) -> list[CanvasShape]:
    selected = set(observation.selected_shape_ids)
    return sorted(
        observation.shapes,
        key=lambda shape: (
            0
            if shape.id in selected
            else 1
            if _intersects_viewport(shape, observation.viewport_page_bounds)
            else 2,
            shape.id,
        ),
    )


def _shape_line(shape: CanvasShape, string_limit: int | None) -> str:
    props = {
        key: _compact_value(shape.props[key], string_limit)
        for key in SEMANTIC_PROPS
        if key in shape.props
    }
    record: dict[str, Any] = {
        "id": shape.id,
        "type": shape.type,
        "x": shape.x,
        "y": shape.y,
        "w": _shape_width(shape),
        "h": _shape_height(shape),
    }
    if props:
        record["props"] = props
    return json.dumps(record, separators=(",", ":"), ensure_ascii=False)


def _compact_value(value: Any, string_limit: int | None) -> Any:
    if isinstance(value, str) and string_limit is not None and len(value) > string_limit:
        return value[: string_limit - 1] + "…"
    if isinstance(value, list):
        return [_compact_value(item, string_limit) for item in value]
    if isinstance(value, dict):
        return {key: _compact_value(item, string_limit) for key, item in value.items()}
    return value


def _intersects_viewport(shape: CanvasShape, viewport: CanvasViewport | None) -> bool:
    if viewport is None:
        return False
    return not (
        shape.x + _shape_width(shape) < viewport.x
        or shape.x > viewport.x + viewport.w
        or shape.y + _shape_height(shape) < viewport.y
        or shape.y > viewport.y + viewport.h
    )


def _shape_width(shape: CanvasShape) -> float:
    value = shape.w if shape.w is not None else shape.props.get("w", 100)
    return float(value) if isinstance(value, (int, float)) else 100.0


def _shape_height(shape: CanvasShape) -> float:
    value = shape.h if shape.h is not None else shape.props.get("h", 100)
    return float(value) if isinstance(value, (int, float)) else 100.0


def _row_positions(
    shapes: list[CanvasShape], start_x: float, start_y: float, gap: float
) -> dict[str, tuple[float, float]]:
    positions: dict[str, tuple[float, float]] = {}
    cursor_x = start_x
    for shape in shapes:
        positions[shape.id] = (cursor_x, start_y)
        cursor_x += _shape_width(shape) + gap
    return positions


def _column_positions(
    shapes: list[CanvasShape], start_x: float, start_y: float, gap: float
) -> dict[str, tuple[float, float]]:
    positions: dict[str, tuple[float, float]] = {}
    cursor_y = start_y
    for shape in shapes:
        positions[shape.id] = (start_x, cursor_y)
        cursor_y += _shape_height(shape) + gap
    return positions


def _grid_positions(
    shapes: list[CanvasShape],
    start_x: float,
    start_y: float,
    gap: float,
    columns: int,
) -> dict[str, tuple[float, float]]:
    column_count = min(columns, len(shapes))
    row_count = (len(shapes) + column_count - 1) // column_count
    column_widths = [0.0] * column_count
    row_heights = [0.0] * row_count
    for index, shape in enumerate(shapes):
        column = index % column_count
        row = index // column_count
        column_widths[column] = max(column_widths[column], _shape_width(shape))
        row_heights[row] = max(row_heights[row], _shape_height(shape))

    column_x = [start_x]
    for width in column_widths[:-1]:
        column_x.append(column_x[-1] + width + gap)
    row_y = [start_y]
    for height in row_heights[:-1]:
        row_y.append(row_y[-1] + height + gap)

    return {
        shape.id: (column_x[index % column_count], row_y[index // column_count])
        for index, shape in enumerate(shapes)
    }

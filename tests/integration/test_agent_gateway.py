import os
import socket
import subprocess
import time
from pathlib import Path

import httpx
import pytest

from agent_service.canvas_client import CanvasGatewayClient
from agent_service.canvas_tools import CanvasToolContext, build_canvas_tools


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.mark.asyncio
async def test_python_tools_create_builtin_and_custom_shapes_headlessly(
    tmp_path: Path,
) -> None:
    port = free_port()
    environment = {
        **os.environ,
        "CANVAS_GATEWAY_PORT": str(port),
        "CANVAS_GATEWAY_DATA_DIR": str(tmp_path),
    }
    process = subprocess.Popen(
        ["npm", "run", "server"],
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        for _ in range(80):
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise AssertionError(f"gateway exited before becoming healthy:\n{output}")
            try:
                response = httpx.get(
                    f"http://127.0.0.1:{port}/health", timeout=0.2
                )
                if response.status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.1)
        else:
            raise AssertionError("gateway did not become healthy")

        client = CanvasGatewayClient(f"ws://127.0.0.1:{port}/canvas")
        initial = await client.execute(
            "canvas_agent_test", [{"type": "read_canvas"}], read_only=True
        )
        context = CanvasToolContext(
            client=client,
            canvas_id="canvas_agent_test",
            observation=initial.observation,
            max_actions=40,
            max_context_chars=24_000,
        )
        tools = {tool.name: tool for tool in build_canvas_tools(context)}

        await tools["create_builtin_shape"].ainvoke(
            {
                "id": "shape:box",
                "shape_type": "geo",
                "x": 10,
                "y": 20,
                "props": {"geo": "rectangle", "w": 100, "h": 80},
            }
        )
        await tools["create_todo_block"].ainvoke(
            {
                "id": "shape:todo",
                "title": "Ship",
                "x": 140,
                "y": 20,
                "tasks": [{"id": "task:one", "text": "Verify"}],
            }
        )

        assert {shape.id for shape in context.observation.shapes} == {
            "shape:box",
            "shape:todo",
        }
        assert (tmp_path / "tldraw-sync.sqlite").is_file()
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

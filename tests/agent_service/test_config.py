import pytest
from pydantic import ValidationError

from agent_service.config import Settings


def test_settings_accept_openai_compatible_endpoint(tmp_path):
    settings = Settings(
        ai_model_base_url="http://model.local/v1",
        ai_model_api_key="secret",
        ai_model_name="tool-model",
        ai_model_reasoning_effort="none",
        ai_database_path=tmp_path / "chat.sqlite",
    )

    assert settings.canvas_gateway_url == "ws://localhost:8787/canvas"
    assert settings.ai_max_tool_calls_per_turn == 12
    assert settings.ai_max_actions_per_turn == 40
    assert settings.ai_model_temperature == 1
    assert settings.ai_model_reasoning_effort == "none"


def test_settings_reject_missing_model_credentials(tmp_path):
    with pytest.raises(ValidationError):
        Settings(
            ai_model_base_url="http://model.local/v1",
            ai_model_api_key="",
            ai_model_name="",
            ai_database_path=tmp_path / "chat.sqlite",
        )

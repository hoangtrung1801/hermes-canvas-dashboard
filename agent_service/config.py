from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_model_base_url: str = Field(min_length=1)
    ai_model_api_key: SecretStr = Field(min_length=1)
    ai_model_name: str = Field(min_length=1)
    ai_model_temperature: float = Field(default=1, ge=0, le=2)
    ai_model_reasoning_effort: Literal[
        "none", "minimal", "low", "medium", "high", "xhigh"
    ] | None = None
    ai_model_timeout_seconds: float = Field(default=60, gt=0)
    ai_service_host: str = "127.0.0.1"
    ai_service_port: int = Field(default=8000, ge=1, le=65535)
    ai_allowed_origins: str = "http://localhost:5173"
    ai_database_path: Path = Path("data/agent-chat.sqlite")
    canvas_gateway_url: str = "ws://localhost:8787/canvas"
    canvas_request_timeout_seconds: float = Field(default=8, gt=0)
    canvas_request_retry_count: int = Field(default=2, ge=0, le=5)
    ai_max_tool_calls_per_turn: int = Field(default=12, ge=1, le=50)
    ai_max_actions_per_turn: int = Field(default=40, ge=1, le=200)
    ai_max_canvas_context_chars: int = Field(default=24000, ge=2000)

    @property
    def allowed_origins(self) -> list[str]:
        return [value.strip() for value in self.ai_allowed_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

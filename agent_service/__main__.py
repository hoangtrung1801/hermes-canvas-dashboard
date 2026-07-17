import uvicorn

from agent_service.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "agent_service.app:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
    )


if __name__ == "__main__":
    main()

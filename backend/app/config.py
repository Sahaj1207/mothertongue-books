from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mock mode returns canned agent output so the app works without API credits.
    use_mock_ai: bool = True
    mock_step_delay: float = 0.9

    # Meta Model API (Standard mode only: never use a "-contributor" model).
    model_api_key: str | None = None
    meta_base_url: str = "https://api.meta.ai/v1"
    story_model: str = "muse-spark-1.3"

    # Muse Spark Open on Baseten, used for the safety reviewer.
    baseten_api_key: str | None = None
    baseten_base_url: str = "https://inference.baseten.co/v1"
    open_weight_model: str = "meta-models/muse-spark-open-1026"

    max_writer_retries: int = 2
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()

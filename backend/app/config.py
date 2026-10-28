from typing import Literal

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

    # "meta": Muse Spark writes, Muse Spark Open reviews safety.
    # "open-weight": every agent runs on Muse Spark Open (used before Meta credits were active).
    story_provider: Literal["meta", "open-weight"] = "meta"

    # New books are refused once today's model spending (UTC day) reaches this.
    daily_budget_usd: float = 2.0

    # Lifetime caps per provider, set below the free credits ($150 Meta, $100 Baseten) with a margin,
    # so the card on file is never charged. Meta's own "spend limit" only sends an email.
    provider_budget_usd: dict[str, float] = {"meta": 120.0, "baseten": 80.0, "modal": 60.0}

    # Illustrations: FLUX.1 [schnell] on a Modal GPU (illustrator_app.py). Off in practice mode.
    illustrations_enabled: bool = True
    illustrator_app: str = "mothertongue-illustrator"
    illustration_concurrency: int = 4

    # Supabase. The service key bypasses row-level security: backend only, never sent to the browser.
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    # Publishable keys are meant to be public; used to verify users' access tokens.
    supabase_publishable_key: str = "sb_publishable_xpi2tGOTJZUeiMYqsO1HLg_sfX4PdVP"

    max_writer_retries: int = 2
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()

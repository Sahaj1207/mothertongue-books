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

    # New books are refused once today's model spending (UTC day) reaches this. A book with Muse Image
    # pictures costs about $0.35, so this allows about 40 a day; the lifetime caps below still hold.
    daily_budget_usd: float = 15.0

    # Lifetime caps per provider, set below the free credits ($150 Meta, $100 Baseten) with a margin,
    # so the card on file is never charged. Meta's own "spend limit" only sends an email.
    provider_budget_usd: dict[str, float] = {"meta": 120.0, "baseten": 80.0, "modal": 60.0}

    # Illustrations, off in practice mode. "muse" (Muse Image on the Meta Model API, $0.01 a picture,
    # with FLUX on Cloudflare as the fallback), "cloudflare" (FLUX.1 [schnell], free plan, about 40 a
    # day) or "modal" (FLUX on a GPU via illustrator_app.py; needs a card on the Modal account).
    illustrations_enabled: bool = True
    illustrator: Literal["muse", "cloudflare", "modal"] = "muse"
    cloudflare_account_id: str | None = None
    cloudflare_api_token: str | None = None
    illustrator_app: str = "mothertongue-illustrator"
    # Read-aloud: Meta's MMS voices on Modal (voice_app.py).
    voice_app: str = "mothertongue-voice"
    illustration_concurrency: int = 4
    # Times the picture checker may send a flawed picture back to be redrawn. One keeps a book near
    # 11 pictures; the adult can redraw any page still flawed from the review page.
    max_picture_redraws: int = 1

    # Supabase. The service key bypasses row-level security: backend only, never sent to the browser.
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    # Publishable keys are meant to be public; used to verify users' access tokens.
    supabase_publishable_key: str = "sb_publishable_xpi2tGOTJZUeiMYqsO1HLg_sfX4PdVP"

    max_writer_retries: int = 2
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()

"""Deploys the FastAPI backend to Modal.

Deploy from backend/:  uv run modal deploy modal_app.py
Secrets come from the Modal secret "mothertongue-books", created from backend/.env.
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("fastapi>=0.162", "httpx>=0.28.1", "openai>=3.39", "pydantic-settings>=2.16.1")
    .add_local_python_source("app")
)

app = modal.App("mothertongue-books")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("mothertongue-books")],
    # Scale to zero when idle; stay up 5 minutes after the last request so a book being made
    # (the client polls every second) finishes on the same container.
    min_containers=0,
    scaledown_window=300,
    timeout=600,
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    import os

    # The live site uses real models; backend/.env (and so the secret) keeps practice mode for local work.
    # Spending stays capped by DAILY_BUDGET_USD and the per-provider budgets in app/config.py.
    os.environ["USE_MOCK_AI"] = "false"

    from app.main import app as fastapi_app

    return fastapi_app

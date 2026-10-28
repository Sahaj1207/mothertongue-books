"""Picture-book illustrations with FLUX.1 [schnell] (Apache 2.0) on a Modal GPU.

Deploy from backend/:  uv run modal deploy illustrator_app.py
Needs the Modal secret "huggingface" (HF_TOKEN) after accepting the model's conditions on Hugging Face.
The backend calls Illustrator.draw remotely; nothing here is exposed on the web.
"""

import io

import modal

MODEL = "black-forest-labs/FLUX.1-schnell"
MODEL_DIR = "/models"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(
        "torch==2.14.1",
        "diffusers==0.42.1",
        "transformers==5.21.0",
        "accelerate==1.15.0",
        "sentencepiece==0.2.2",
        "protobuf==7.36.2",
        "huggingface-hub==2.3.0",
        "pillow==13.0.0",
    )
    .env({"HF_HOME": MODEL_DIR})
)

weights = modal.Volume.from_name("flux-weights", create_if_missing=True)
app = modal.App("mothertongue-illustrator")


@app.cls(
    image=image,
    gpu="L40S",
    volumes={MODEL_DIR: weights},
    secrets=[modal.Secret.from_name("huggingface")],
    # GPUs cost money while idle, so containers stop a minute after the last picture.
    scaledown_window=60,
    timeout=600,
    max_containers=2,
)
class Illustrator:
    @modal.enter()
    def load(self) -> None:
        import torch
        from diffusers import FluxPipeline

        self.pipe = FluxPipeline.from_pretrained(MODEL, torch_dtype=torch.bfloat16).to("cuda")
        weights.commit()

    @modal.method()
    def draw(self, prompt: str, seed: int, width: int = 1024, height: int = 768) -> bytes:
        """Returns a WebP image. The same seed and prompt always give the same picture."""
        import torch

        result = self.pipe(
            prompt,
            num_inference_steps=4,
            guidance_scale=0.0,
            width=width,
            height=height,
            max_sequence_length=256,
            generator=torch.Generator("cuda").manual_seed(seed),
        )
        buf = io.BytesIO()
        result.images[0].save(buf, format="WEBP", quality=88)
        return buf.getvalue()

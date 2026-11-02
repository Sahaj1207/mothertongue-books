"""Reads book pages and words aloud with Meta's MMS text-to-speech (VITS) models, on Modal CPUs.

Deploy from backend/:  uv run modal deploy voice_app.py
The backend calls Voice.speak remotely and saves each clip once; nothing here is exposed on the web.
MMS has no isiZulu or Nepali voice, so those books keep using the device's own voice.
The models are CC BY-NC 4.0, which fits a free, non-commercial site.
"""

import modal

# Our language codes to MMS's (ISO 639-3).
MMS_CODES = {"kn": "kan", "te": "tel", "mr": "mar", "sw": "swh", "ht": "hat", "eu": "eus"}
MODEL_DIR = "/models"


def download() -> None:
    from transformers import AutoTokenizer, VitsModel

    for code in MMS_CODES.values():
        AutoTokenizer.from_pretrained(f"facebook/mms-tts-{code}")
        VitsModel.from_pretrained(f"facebook/mms-tts-{code}")


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .uv_pip_install("torch==2.5.1", index_url="https://download.pytorch.org/whl/cpu")
    .uv_pip_install("transformers==4.46.3", "numpy<2.3")
    .env({"HF_HOME": MODEL_DIR})
    # The six models (36M parameters each) are baked into the image, so a cold start only loads them.
    .run_function(download)
)

app = modal.App("mothertongue-voice")


# One clip at a time per container: the speaking rate and noise are set on the shared model per clip.
@app.cls(image=image, cpu=2.0, memory=3072, scaledown_window=300, timeout=120, max_containers=4)
class Voice:
    @modal.enter()
    def load(self) -> None:
        import torch
        from transformers import AutoTokenizer, VitsModel

        torch.set_num_threads(2)
        self.models = {
            ours: (
                AutoTokenizer.from_pretrained(f"facebook/mms-tts-{mms}"),
                VitsModel.from_pretrained(f"facebook/mms-tts-{mms}"),
            )
            for ours, mms in MMS_CODES.items()
        }

    @modal.method()
    def speak(self, language: str, text: str, rate: float = 1.0, noise: float = 0.667, seed: int = 0) -> dict:
        """Reads the text sentence by sentence, with a short pause between, which sounds far less flat
        than one long breath. Returns the MP3 for readers and a 16 kHz WAV for the clip checker.
        The same arguments always give the same clip; another seed gives another reading."""
        import re
        import subprocess

        import numpy as np
        import torch

        tokenizer, model = self.models[language]
        model.speaking_rate = rate
        model.noise_scale = noise
        sentences = [s for s in re.split(r"(?<=[.!?।॥])\s+", text.strip()) if s.strip()]
        sr = model.config.sampling_rate
        gap = np.zeros(int(sr * 0.35), dtype=np.float32)
        parts = []
        for i, sentence in enumerate(sentences):
            torch.manual_seed(seed * 1000 + i)
            with torch.no_grad():
                parts.append(model(**tokenizer(sentence, return_tensors="pt")).waveform[0].numpy())
            parts.append(gap)
        wave = np.concatenate([np.zeros(int(sr * 0.15), dtype=np.float32), *parts])
        pcm = (np.clip(wave, -1, 1) * 32767).astype("<i2").tobytes()

        def encode(*args: str) -> bytes:
            raw = ["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-"]
            return subprocess.run([*raw, *args, "-"], input=pcm, capture_output=True, check=True).stdout

        return {"mp3": encode("-b:a", "64k", "-f", "mp3"), "wav": encode("-c:a", "pcm_s16le", "-f", "wav")}

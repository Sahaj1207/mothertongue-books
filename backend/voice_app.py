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


# One clip at a time per container: the speaking rate is set on the shared model for each clip.
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
    def speak(self, language: str, text: str, rate: float = 1.0) -> bytes:
        """Returns an MP3 of the text. The same text, language and rate always sound the same."""
        import subprocess

        import numpy as np
        import torch

        tokenizer, model = self.models[language]
        model.config.speaking_rate = rate
        inputs = tokenizer(text, return_tensors="pt")
        torch.manual_seed(0)
        with torch.no_grad():
            wave = model(**inputs).waveform[0].numpy()
        pcm = (np.clip(wave, -1, 1) * 32767).astype("<i2").tobytes()
        # A short pause before and after, so the first syllable isn't clipped by the browser.
        return subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-f",
                "s16le",
                "-ar",
                str(model.config.sampling_rate),
                "-ac",
                "1",
                "-i",
                "-",
                "-af",
                "adelay=120,apad=pad_dur=0.2",
                "-b:a",
                "64k",
                "-f",
                "mp3",
                "-",
            ],
            input=pcm,
            capture_output=True,
            check=True,
        ).stdout

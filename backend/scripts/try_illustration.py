"""Draws one test picture on the deployed illustrator and saves it, with timing.

Run from backend/:  uv run python -m scripts.try_illustration out.webp
"""

import sys
import time

import modal

STYLE = (
    "Children's picture book illustration, soft gouache and watercolour, warm natural light, gentle "
    "rounded shapes, simple uncluttered background, Indian village setting, no text, no letters."
)
SCENE = (
    "A happy six-year-old Indian girl named Chinni with two braids, a yellow pavadai skirt and red bangles, "
    "flying a red kite on a rooftop on Sankranti morning, her grandfather clapping beside her, blue sky "
    "with other colourful kites."
)


def main(out: str) -> None:
    draw = modal.Cls.from_name("mothertongue-illustrator", "Illustrator")().draw
    for attempt in ("cold", "warm"):
        start = time.perf_counter()
        data = draw.remote(f"{STYLE} {SCENE}", seed=7)
        print(f"{attempt}: {time.perf_counter() - start:.1f}s, {len(data) // 1024} KB")
    with open(out, "wb") as f:
        f.write(data)
    print(f"saved {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "illustration.webp")

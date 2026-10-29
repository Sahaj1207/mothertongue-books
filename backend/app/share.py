"""Link previews for WhatsApp and other apps: their crawlers don't run the React app, so they get this page."""

import io
from html import escape

import httpx
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response

from app.agents.agents import LANGUAGE_NAMES
from app.models import Book
from app.store import store

SITE = "https://mothertongue-books.vercel.app"
AGES = {1: "3–5", 2: "5–7", 3: "7–9"}
KIND = {
    "original": "picture book",
    "two-language": "two-language picture book",
    "folk-tale": "retold folk tale",
}

router = APIRouter()


async def _published(book_id: str) -> Book | None:
    book = await store.get_book(book_id)
    # Drafts are private: a shared draft link gets the site's own preview, not the book's.
    return book if book and book.status == "published" else None


@router.get("/api/share/{book_id}", response_class=HTMLResponse)
async def share_page(book_id: str) -> HTMLResponse:
    book = await _published(book_id)
    url = f"{SITE}/books/{book_id}"
    if book is None:
        title, description, image = "MotherTongue Books", "Picture books in your child's own language.", None
    else:
        main = book.drafts[0]
        languages = " and ".join(LANGUAGE_NAMES[d.language] for d in book.drafts)
        title = f"{main.title} · {book.plan.title_en}"
        description = f"A {languages} {KIND[book.request.kind]} for ages {AGES[book.request.level]}, on MotherTongue Books."
        image = f"{SITE}/api/share/{book_id}/cover.jpg" if book.images else None
    tags = [
        ("og:type", "book"),
        ("og:site_name", "MotherTongue Books"),
        ("og:title", title),
        ("og:description", description),
        ("og:url", url),
    ]
    if image:
        tags += [("og:image", image), ("og:image:width", "600"), ("og:image:height", "600")]
    meta = "\n".join(f'<meta property="{k}" content="{escape(v)}">' for k, v in tags)
    card = "summary_large_image" if image else "summary"
    return HTMLResponse(
        f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
{meta}
<meta name="twitter:card" content="{card}">
<meta http-equiv="refresh" content="0; url={escape(url)}">
</head><body><a href="{escape(url)}">{escape(title)}</a></body></html>""",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/api/share/{book_id}/cover.jpg")
async def share_cover(book_id: str) -> Response:
    """Page 1 as a small JPEG: preview cards don't reliably show WebP, and WhatsApp wants it light."""
    from PIL import Image

    book = await _published(book_id)
    first = book and min(book.images, default=None)
    if not book or first is None:
        return Response(status_code=404)
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.get(book.images[first])
        r.raise_for_status()
    with Image.open(io.BytesIO(r.content)) as img:
        img = img.convert("RGB")
        img.thumbnail((600, 600))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=82)
    return Response(
        out.getvalue(), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"}
    )

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Query
from app.models.product import ScrapeRequest
from app.services.scraper import scrape_product_info, _get_lock
# pyrefly: ignore [missing-import]
from fastapi.concurrency import run_in_threadpool
from app.services.inference import run_inference, calculate_nss_and_breakdown, group_reviews_by_id
from app.services.product_service import get_all_products, get_product_by_id, save_product, search_products, get_product_by_url
from urllib.parse import urlparse, urlunparse
import asyncio

# ── Router: general product endpoints ────────────────────────
router = APIRouter(prefix="/api", tags=["products"])

# ── Router: scrape endpoint (separate so main.py can mount both) ──
scrape_router = APIRouter(prefix="/api", tags=["scrape"])


# ── In-memory scrape status tracker ──────────────────────────
# Struktur: { url: { "status": "running"|"done"|"error", "product_id": str|None, "error": str|None } }
_scrape_status: dict[str, dict] = {}

# ── Keyword validasi URL untuk produk lip ────────────────────
LIP_KEYWORDS = [
    "lip", "lips", "lipstick", "lip-tint", "lipcream", "lip-cream",
    "lip-gloss", "lipgloss", "lip-balm", "lipbalm", "liptint",
    "liquid-lipstick", "matte-lip", "lip-liner", "lipliner",
]


def _normalize_url(url: str) -> str:
    """
    Bersihkan URL dari noise sebelum diproses:
      - Strip whitespace
      - Buang query string (?page=3&utm_source=ig, dll)
      - Buang fragment (#reviews, dll)
      - Buang trailing slash di path
    Contoh:
      https://reviews.femaledaily.com/lip/lipstick/brand/?page=2&utm=ig#top
      → https://reviews.femaledaily.com/lip/lipstick/brand
    """
    try:
        parsed = urlparse(url.strip())
        clean_path = parsed.path.rstrip("/")
        return urlunparse((parsed.scheme, parsed.netloc, clean_path, "", "", ""))
    except Exception:
        return url.strip()


def _is_lip_url(url: str) -> bool:
    """Periksa apakah path URL mengandung keyword produk lip."""
    try:
        path = urlparse(url).path.lower()
        return any(kw in path for kw in LIP_KEYWORDS)
    except Exception:
        return False


@router.get("/products")
async def list_products():
    """Return all products stored in MongoDB (without reviews for speed)."""
    products = await get_all_products()
    return {"products": products}


@router.get("/products/search")
async def search(q: str = ""):
    """Cari produk di DB berdasarkan nama atau brand."""
    if not q:
        return []
    return await search_products(q)


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Return a single product with full review list."""
    product = await get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return product


@scrape_router.get("/scrape/status")
async def get_scrape_status(url: str = Query(..., description="URL produk yang sedang di-scrape")):
    """
    Cek status scraping untuk URL tertentu.

    Returns:
        { status: "running" | "done" | "error" | "idle", product_id?: str, error?: str }
    """
    clean_url = _normalize_url(url)
    status_info = _scrape_status.get(clean_url)
    if not status_info:
        return {"status": "idle"}
    return status_info


@scrape_router.post("/scrape")
async def scrape_and_analyze(body: ScrapeRequest):
    """
    Scrape a product URL, run ABSA inference, compute NSS scores,
    persist to MongoDB, and return the full result.

    Validations (before scraping):
    - URL must come from reviews.femaledaily.com            [422]
    - URL path must contain lip-related keywords            [422]
    - Product must not already exist in MongoDB             [409]

    Concurrency guard:
    - Per-URL async lock prevents duplicate concurrent scrapes [409]
    """
    # ── 0. Normalisasi URL — buang query string, fragment, trailing slash ─────
    body.url = _normalize_url(body.url)

    # ── 1. Validasi domain Female Daily ───────────────────────────────────────
    try:
        parsed = urlparse(body.url)
        hostname = parsed.hostname or ""
    except Exception:
        hostname = ""

    ALLOWED_DOMAINS = ("reviews.femaledaily.com", "femaledaily.com")
    if not any(hostname == d or hostname.endswith("." + d) for d in ALLOWED_DOMAINS):
        raise HTTPException(
            status_code=422,
            detail=(
                "URL tidak valid. Hanya link produk dari "
                "reviews.femaledaily.com yang dapat dianalisis."
            ),
        )

    # ── 2. Validasi URL harus produk lip ─────────────────────────────────────
    if not _is_lip_url(body.url):
        raise HTTPException(
            status_code=422,
            detail=(
                "URL tidak valid. Hanya produk bibir (lip product) yang dapat dianalisis. "
                "Pastikan URL mengandung kategori lip/lips/lipstick/lip-tint/dll."
            ),
        )

    # ── 3. Cek apakah produk sudah pernah di-scrape ───────────────────────────
    existing = await get_product_by_url(body.url)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Produk ini sudah pernah dianalisis sebelumnya.",
                "product_id": existing["_id"],
            },
        )

    # ── 4. Concurrency lock ───────────────────────────────────────────────────
    lock = _get_lock(body.url)
    if lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Scraping untuk URL ini sedang berjalan. Harap tunggu.",
        )

    async with lock:
        # Tandai status = running
        _scrape_status[body.url] = {"status": "running", "product_id": None, "error": None}

        try:
            # 1. Scrape — Playwright async, tidak memblokir event loop FastAPI
            #    `days` meneruskan filter waktu dari request body (None = semua ulasan)
            raw = await scrape_product_info(body.url, days=body.days)

            # 2. Inference (juga di background thread)
            reviews_labeled = await run_in_threadpool(run_inference, raw["reviews_raw"])

            # 3. Calculate NSS & breakdown
            analysis = calculate_nss_and_breakdown(reviews_labeled)

            # 3b. Grouped reviews — satu entry per ulasan unik (untuk tab Per Ulasan)
            reviews_grouped = group_reviews_by_id(reviews_labeled)

            # 4. Build document
            product_doc = {
                "product_name":           raw["product_name"],
                "product_brand":          raw["product_brand"],
                "product_image":          raw.get("product_image"),
                "product_shade":          raw.get("product_shade"),
                "product_url":            raw["product_url"],
                "total_reviews":          len(raw["reviews_raw"]),
                "overall_nss":            analysis["overall_nss"],
                "nss_scores":             analysis["nss_scores"],
                "absa_aspects":           analysis["absa_aspects"],
                "sentiment_distribution": analysis["sentiment_distribution"],
                "reviews":                reviews_labeled,
                "reviews_grouped":        reviews_grouped,
                "isTrending":             len(raw["reviews_raw"]) > 1000,
            }

            # 5. Save / upsert to MongoDB
            product_id = await save_product(product_doc)
            product_doc["_id"] = product_id

            # 6. Update status = done
            _scrape_status[body.url] = {
                "status": "done",
                "product_id": product_id,
                "error": None,
            }

            return product_doc

        except Exception as exc:
            # Update status = error
            _scrape_status[body.url] = {
                "status": "error",
                "product_id": None,
                "error": str(exc),
            }
            raise

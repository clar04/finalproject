# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
from app.models.product import ScrapeRequest
from app.services.scraper import scrape_product_info, _get_lock
# pyrefly: ignore [missing-import]
from fastapi.concurrency import run_in_threadpool
from app.services.inference import run_inference, calculate_nss_and_breakdown, group_reviews_by_id
from app.services.product_service import get_all_products, get_product_by_id, save_product, search_products, get_product_by_url
from urllib.parse import urlparse


# ── Router: general product endpoints ────────────────────────
router = APIRouter(prefix="/api", tags=["products"])

# ── Router: scrape endpoint (separate so main.py can mount both) ──
scrape_router = APIRouter(prefix="/api", tags=["scrape"])


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


@scrape_router.post("/scrape")
async def scrape_and_analyze(body: ScrapeRequest):
    """
    Scrape a product URL, run ABSA inference, compute NSS scores,
    persist to MongoDB, and return the full result.

    Validations (before scraping):
    - URL must come from reviews.femaledaily.com            [422]
    - Product must not already exist in MongoDB             [409]

    Concurrency guard:
    - Per-URL async lock prevents duplicate concurrent scrapes [409]
    """
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

    # ── 2. Cek apakah produk sudah pernah di-scrape ───────────────────────────
    existing = await get_product_by_url(body.url)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Produk ini sudah pernah dianalisis sebelumnya.",
                "product_id": existing["_id"],
            },
        )

    # ── 3. Concurrency lock ───────────────────────────────────────────────────
    lock = _get_lock(body.url)
    if lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Scraping untuk URL ini sedang berjalan. Harap tunggu.",
        )

    async with lock:
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
            "product_url":            raw["product_url"],
            "total_reviews":          len(raw["reviews_raw"]),   # jumlah review unik (sebelum ABSA expansion)
            "overall_nss":            analysis["overall_nss"],
            "nss_scores":             analysis["nss_scores"],
            "absa_aspects":           analysis["absa_aspects"],
            "sentiment_distribution": analysis["sentiment_distribution"],
            "reviews":                reviews_labeled,
            "reviews_grouped":        reviews_grouped,   # satu entry per ulasan + list aspek
            "isTrending":             len(raw["reviews_raw"]) > 1000,
        }

        # 5. Save / upsert to MongoDB
        product_id = await save_product(product_doc)
        product_doc["_id"] = product_id

        return product_doc

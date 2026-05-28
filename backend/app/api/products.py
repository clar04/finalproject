# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
from app.models.product import ScrapeRequest
from app.services.scraper import scrape_product_info, _get_lock
from fastapi.concurrency import run_in_threadpool
from app.services.inference import run_inference, calculate_nss_and_breakdown
from app.services.product_service import get_all_products, get_product_by_id, save_product, search_products

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

    A per-URL async lock prevents duplicate concurrent scrapes:
    if the same URL is already being processed, a 409 is returned immediately.
    """
    lock = _get_lock(body.url)
    if lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Scraping untuk URL ini sedang berjalan. Harap tunggu.",
        )

    async with lock:
        # 1. Scrape (berjalan di background thread agar tidak memblokir event loop)
        raw = await run_in_threadpool(scrape_product_info, body.url)

        # 2. Inference (juga di background thread)
        reviews_labeled = await run_in_threadpool(run_inference, raw["reviews_raw"])

        # 3. Calculate NSS & breakdown
        analysis = calculate_nss_and_breakdown(reviews_labeled)

        # 4. Build document
        product_doc = {
            "product_name":           raw["product_name"],
            "product_brand":          raw["product_brand"],
            "product_image":          raw.get("product_image"),
            "product_url":            raw["product_url"],
            "total_reviews":          len(reviews_labeled),
            "overall_nss":            analysis["overall_nss"],
            "nss_scores":             analysis["nss_scores"],
            "absa_aspects":           analysis["absa_aspects"],
            "sentiment_distribution": analysis["sentiment_distribution"],
            "reviews":                reviews_labeled,
            "isTrending":             len(reviews_labeled) > 1000,
        }

        # 5. Save / upsert to MongoDB
        product_id = await save_product(product_doc)
        product_doc["_id"] = product_id

        return product_doc

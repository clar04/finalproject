import asyncio
import re
import time

import requests
from bs4 import BeautifulSoup

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

REQUEST_TIMEOUT  = 20    # seconds per HTTP request
REQUEST_DELAY    = 0.5   # seconds between page requests
MAX_EMPTY_PAGES  = 2     # stop after N consecutive empty pages (guard against infinite loop)
MAX_PAGES        = 200   # absolute safety cap

# ── Global scrape lock — prevents concurrent scrapes of the same URL ──────────
# Maps url → asyncio.Lock so that identical concurrent requests are serialised.
_scrape_locks: dict[str, asyncio.Lock] = {}


def _get_lock(url: str) -> asyncio.Lock:
    """Return (or create) a per-URL async lock."""
    if url not in _scrape_locks:
        _scrape_locks[url] = asyncio.Lock()
    return _scrape_locks[url]


# ──────────────────────────────────────────────
# HTML EXTRACTORS
# ──────────────────────────────────────────────

def _extract_reviews_from_page(soup: BeautifulSoup) -> list[dict]:
    """
    Extract all review cards present on a single page.

    Targets inside each div.review-card:
        .text-content  → review body text
        .review-date   → publication date
        .profile-name / .username → reviewer name
    """
    reviews = []

    for card in soup.select("div.review-card"):
        text_el   = card.select_one(".text-content")
        date_el   = card.select_one(".review-date")
        author_el = card.select_one(".profile-name") or card.select_one(".username")

        review_text = text_el.get_text(" ", strip=True) if text_el else None
        if not review_text:
            continue

        reviews.append({
            "content"   : review_text,
            "date"      : date_el.get_text(strip=True) if date_el else "Unknown Date",
            "author"    : author_el.get_text(strip=True) if author_el else "FemaleDaily User",
            "isVerified": True,
        })

    return reviews


def _extract_product_meta(soup: BeautifulSoup) -> tuple[str, str, str | None]:
    """
    Extract (product_name, product_brand, product_image) from page 1 HTML.
    Returns safe defaults when elements are not found.
    """
    name_tag  = soup.select_one('[class*="product-name"]') or soup.find("h1")
    brand_tag = soup.select_one('[class*="product-brand"]') or soup.select_one('[class*="brand-name"]')
    img_tag   = soup.find("img", src=re.compile(r"image\.femaledaily\.com.*/prod-pics/"))

    product_name  = name_tag.get_text(strip=True)  if name_tag  else "Unknown Product"
    product_brand = brand_tag.get_text(strip=True) if brand_tag else "Unknown Brand"

    product_image = None
    if img_tag and img_tag.get("src"):
        src = img_tag["src"]
        product_image = ("https:" + src) if src.startswith("//") else src

    return product_name, product_brand, product_image


# ──────────────────────────────────────────────
# MAIN SCRAPER
# ──────────────────────────────────────────────

def scrape_product_info(url: str) -> dict:
    """
    Scrape product metadata and all paginated reviews from a Female Daily URL.

    Safety guards:
    - Stops after MAX_EMPTY_PAGES consecutive empty pages (not just the first).
    - Hard-caps at MAX_PAGES to prevent infinite loops.
    - REQUEST_DELAY between requests to avoid rate-limiting.

    Returns:
        {product_name, product_brand, product_image, product_url, reviews_raw}
    """
    all_reviews:   list[dict] = []
    product_name  = "Unknown Product"
    product_brand = "Unknown Brand"
    product_image = None

    empty_streak = 0   # consecutive empty pages counter

    for page in range(1, MAX_PAGES + 1):
        paged_url = f"{url}?page={page}"
        print(f"[Scraper] Scraping {paged_url} ...")

        try:
            response = requests.get(paged_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
        except Exception as exc:
            print(f"[Scraper] Failed to fetch page {page}: {exc}")
            break

        # Metadata — extracted once from the first page
        if page == 1:
            product_name, product_brand, product_image = _extract_product_meta(soup)

        page_reviews = _extract_reviews_from_page(soup)

        if not page_reviews:
            empty_streak += 1
            print(f"[Scraper] Page {page} is empty (streak={empty_streak}/{MAX_EMPTY_PAGES}).")
            if empty_streak >= MAX_EMPTY_PAGES:
                print("[Scraper] Reached max empty streak — stopping pagination.")
                break
        else:
            empty_streak = 0   # reset streak on any successful page
            all_reviews.extend(page_reviews)
            print(f"[Scraper] Page {page}: {len(page_reviews)} reviews (total={len(all_reviews)})")

        time.sleep(REQUEST_DELAY)

    # Attach sequential IDs
    for i, rev in enumerate(all_reviews):
        rev["id"] = str(i + 1)

    print(f"[Scraper] Done — {len(all_reviews)} reviews collected for '{product_name}'.")

    return {
        "product_name" : product_name,
        "product_brand": product_brand,
        "product_image": product_image,
        "product_url"  : url,
        "reviews_raw"  : all_reviews,
    }
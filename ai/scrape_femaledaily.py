"""
Female Daily - Product Review Scraper
======================================
Scrapes product metadata & all paginated reviews from Female Daily product URLs.

Usage:
    python female_daily_scraper.py

Input  : test-link.txt        (one product URL per line)
Output : data/raw/test_raw_data.csv
"""

import csv
import os
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

LINK_FILE  = "test-link.txt"
OUTPUT_CSV = "data/raw/test_raw_data5.csv"
REQUEST_DELAY = 1.5   # seconds between page requests
REQUEST_TIMEOUT = 20  # seconds per request


# ──────────────────────────────────────────────
# HTTP
# ──────────────────────────────────────────────

def get_soup(url: str) -> BeautifulSoup:
    """Fetch a URL and return a BeautifulSoup object."""
    response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


# ──────────────────────────────────────────────
# EXTRACTORS
# ──────────────────────────────────────────────

def _safe_text(soup: BeautifulSoup, selector: str) -> str | None:
    """Return stripped text of the first matching element, or None."""
    element = soup.select_one(selector)
    return element.get_text(strip=True) if element else None


def extract_product_metadata(soup: BeautifulSoup, product_url: str) -> dict:
    """
    Extract product-level fields from a product page.

    Female Daily uses JSX-hashed class names, e.g.:
        class="jsx-2016320139 jsx-2462230538 product-brand"
        class="jsx-2016320139 jsx-2462230538 product-name"
        class="jsx-2016320139 jsx-2462230538 product-shade"
        class="jsx-2016320139 jsx-2462230538 product-price"

    We match using [class*="keyword"] to handle the dynamic hash prefixes.
    """
    brand = _safe_text(soup, '[class*="product-brand"]')
    name  = _safe_text(soup, '[class*="product-name"]')
    shade = _safe_text(soup, '[class*="product-shade"]')
    price = _safe_text(soup, '[class*="product-price"]')

    return {
        "product_url":   product_url,
        "product_brand": brand,
        "product_name":  name,
        "product_shade": shade,
        "product_price": price,
    }


def extract_reviews(soup: BeautifulSoup) -> list[dict]:
    """
    Extract all review cards from a single page.

    Targets inside each div.review-card:
        class="review-date"   → publication date
        class="text-content"  → review body text
    """
    reviews = []

    for card in soup.select("div.review-card"):
        text_el = card.select_one(".text-content")
        date_el = card.select_one(".review-date")

        review_text = text_el.get_text(" ", strip=True) if text_el else None
        review_date = date_el.get_text(strip=True)       if date_el else None

        if review_text:
            reviews.append({
                "review_date": review_date,
                "review_text": review_text,
            })

    return reviews


# ──────────────────────────────────────────────
# SCRAPER
# ──────────────────────────────────────────────

def scrape_product(product_url: str) -> list[dict]:
    """
    Scrape all reviews for a single product URL, following pagination
    automatically until no more reviews are found.

    Returns a flat list of dicts — one row per review.
    """
    all_rows: list[dict] = []
    product_meta: dict | None = None
    page = 1

    while True:
        paged_url = f"{product_url}?page={page}"
        print(f"  → Page {page}: {paged_url}")

        try:
            soup = get_soup(paged_url)
        except requests.RequestException as exc:
            print(f"  [WARN] Failed to fetch page {page}: {exc}")
            break

        # Extract metadata only once (from page 1)
        if product_meta is None:
            product_meta = extract_product_metadata(soup, product_url)
            print(
                f"  Product: {product_meta['product_brand']} – "
                f"{product_meta['product_name']}"
            )

        reviews = extract_reviews(soup)

        if not reviews:
            print(f"  No reviews found on page {page}. Stopping pagination.")
            break

        for review in reviews:
            all_rows.append({**product_meta, **review})

        print(f"  Collected {len(reviews)} reviews (total so far: {len(all_rows)})")
        page += 1
        time.sleep(REQUEST_DELAY)

    return all_rows


# ──────────────────────────────────────────────
# I/O HELPERS
# ──────────────────────────────────────────────

def load_links(path: str) -> list[str]:
    """Read product URLs from a text file (one URL per line)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Link file not found: {path}")
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def save_csv(data: list[dict], path: str) -> None:
    """Write scraped data to a CSV file, creating parent directories as needed."""
    if not data:
        print("No data to save.")
        return

    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    print(f"\n✓ Saved {len(data)} rows → {path}")


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main() -> None:
    links = load_links(LINK_FILE)
    print(f"Loaded {len(links)} product link(s) from '{LINK_FILE}'\n")

    all_data: list[dict] = []

    for index, link in enumerate(links, start=1):
        print(f"[{index}/{len(links)}] Scraping: {link}")
        try:
            rows = scrape_product(link)
            all_data.extend(rows)
            print(f"  Done. {len(rows)} review(s) collected.")
        except Exception as exc:
            print(f"  [ERROR] Skipping product — {exc}")

    save_csv(all_data, OUTPUT_CSV)


if __name__ == "__main__":
    main()
import requests
from bs4 import BeautifulSoup
import time
import csv
import os

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

LINK_FILE = "test-link.txt"
OUTPUT_CSV = "data/raw/test_raw_data.csv"


def get_soup(url):
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


# =======================
# PRODUCT METADATA
# =======================
def extract_product_metadata(soup):
    def safe_text(selector):
        el = soup.select_one(selector)
        return el.get_text(strip=True) if el else None

    return {
        "product_brand": safe_text(".product-brand"),
        "product_name": safe_text(".product-name"),
        "product_shade": safe_text(".product-shade"),
        "product_price": safe_text(".product-price"),
    }


# =======================
# REVIEWS
# =======================
def extract_reviews(soup):
    reviews = []

    review_cards = soup.select("div.review-card")

    for card in review_cards:
        review_text = card.select_one(".review-text")
        review_date = card.select_one(".review-date")

        reviews.append({
            "review_text": review_text.get_text(strip=True) if review_text else None,
            "review_date": review_date.get_text(strip=True) if review_date else None
        })

    return reviews


# =======================
# SCRAPER PER PRODUCT
# =======================
def scrape_product(product_url):
    all_reviews = []
    page = 1
    product_meta = None

    while True:
        paged_url = f"{product_url}?page={page}"
        print(f"Scraping page {page}: {paged_url}")

        soup = get_soup(paged_url)

        if product_meta is None:
            product_meta = extract_product_metadata(soup)
            product_meta["product_url"] = product_url

        reviews = extract_reviews(soup)

        # STOP kalau tidak ada review
        if not reviews:
            break

        for r in reviews:
            all_reviews.append({**product_meta, **r})

        page += 1
        time.sleep(1)

    return all_reviews


# =======================
# UTIL
# =======================
def load_product_links(path):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def save_to_csv(data, output_path):
    if not data:
        print("No data collected.")
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fieldnames = data[0].keys()

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

    print(f"Saved {len(data)} rows to {output_path}")


# =======================
# MAIN
# =======================
def main():
    product_links = load_product_links(LINK_FILE)
    all_data = []

    for idx, link in enumerate(product_links, start=1):
        print(f"\n[{idx}/{len(product_links)}] Processing product")
        try:
            product_data = scrape_product(link)
            all_data.extend(product_data)
        except Exception as e:
            print(f"FAILED: {link} | {e}")

    save_to_csv(all_data, OUTPUT_CSV)


if __name__ == "__main__":
    main()
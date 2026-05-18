"""
Female Daily - HTML Structure Debugger
========================================
Run this FIRST to inspect the actual HTML selectors used by Female Daily.
It will dump the page HTML and test various CSS selectors.

Usage:
    python debug_selectors.py
"""

import time
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ── CONFIG ──────────────────────────────────────────────────────────────────
TEST_URL  = "https://reviews.femaledaily.com/products/lips/lipstick/omg/oh-my-glam-mattelast-lip-cream-24-berry?page=1"
DUMP_HTML = "debug_page.html"   # full HTML saved here for manual inspection

SELECTORS_TO_TEST = [
    # Review containers (most likely culprits)
    "div.review-card",
    "[class*='review-card']",
    "[class*='ReviewCard']",
    "[class*='review-item']",
    "[class*='ReviewItem']",
    "[class*='review-list']",
    "[class*='ulasan']",
    "[class*='comment']",
    "[data-testid*='review']",

    # Review text
    ".text-content",
    "[class*='text-content']",
    "[class*='review-text']",
    "[class*='ReviewText']",
    "[class*='review-body']",

    # Review date
    ".review-date",
    "[class*='review-date']",
    "[class*='ReviewDate']",
    "time",

    # Product meta
    '[class*="product-brand"]',
    '[class*="product-name"]',
    '[class*="product-shade"]',
    '[class*="product-price"]',
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def scroll_to_bottom(page):
    prev_h = 0
    for _ in range(15):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1.5)
        h = page.evaluate("document.body.scrollHeight")
        if h == prev_h:
            break
        prev_h = h


def main():
    print(f"Loading: {TEST_URL}\n")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        try:
            page.goto(TEST_URL, timeout=30_000, wait_until="domcontentloaded")
        except PlaywrightTimeoutError:
            print("[WARN] Timeout — proceeding anyway.")

        # Wait a bit for JS to hydrate
        print("Waiting 6s for JS to render...")
        time.sleep(6)
        scroll_to_bottom(page)

        # ── Dump HTML ──────────────────────────────────────────────────────
        html = page.content()
        with open(DUMP_HTML, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Full HTML saved → {DUMP_HTML}  ({len(html):,} chars)\n")

        # ── Test selectors ─────────────────────────────────────────────────
        print("=" * 60)
        print("SELECTOR TEST RESULTS")
        print("=" * 60)

        found = []
        for sel in SELECTORS_TO_TEST:
            try:
                els = page.query_selector_all(sel)
                count = len(els)
                status = "✓" if count > 0 else "✗"
                print(f"  {status}  {sel:<45}  → {count} element(s)")
                if count > 0:
                    found.append((sel, count))
            except Exception as exc:
                print(f"  ?  {sel:<45}  → ERROR: {exc}")

        # ── Print first matching text for found selectors ──────────────────
        if found:
            print("\n" + "=" * 60)
            print("SAMPLE TEXT FROM MATCHING SELECTORS")
            print("=" * 60)
            for sel, count in found[:10]:
                try:
                    el = page.query_selector(sel)
                    snippet = el.inner_text().strip()[:120].replace("\n", " ")
                    print(f"  {sel}\n    → \"{snippet}\"\n")
                except Exception:
                    pass

        # ── Dump all class names that contain 'review' ────────────────────
        print("=" * 60)
        print("ALL CLASSES CONTAINING 'review' or 'ulasan' OR 'rating'")
        print("=" * 60)
        class_hits = page.evaluate("""
            () => {
                const hits = new Set();
                document.querySelectorAll('[class]').forEach(el => {
                    el.className.toString().split(/\\s+/).forEach(cls => {
                        const lower = cls.toLowerCase();
                        if (lower.includes('review') || lower.includes('ulasan') || lower.includes('rating')) {
                            hits.add(cls);
                        }
                    });
                });
                return Array.from(hits).sort();
            }
        """)
        for cls in class_hits:
            print(f"  .{cls}")

        context.close()
        browser.close()

    print("\nDone! Open debug_page.html in your browser to inspect manually.")


if __name__ == "__main__":
    main()
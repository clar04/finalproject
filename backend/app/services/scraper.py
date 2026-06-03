"""
Female Daily - Playwright Async Scraper
========================================
Scrapes product metadata & all paginated reviews from Female Daily URLs.

Features:
  - Headless Playwright (async) untuk halaman JS-rendered
  - Auto-Retry 3x dengan exponential backoff per page
  - Time-Based Filtering via parameter `days`
"""

import asyncio
import re
from datetime import datetime, timedelta

# pyrefly: ignore [missing-import]
from bs4 import BeautifulSoup
# pyrefly: ignore [missing-import]
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_DELAY   = 0.5   # seconds between page requests
JS_WAIT_MS      = 3000  # milliseconds to wait for JS hydration after page load
MAX_RETRIES     = 3     # max retry attempts per page before giving up
MAX_EMPTY_PAGES = 5     # stop after N consecutive empty pages (dinaikkan agar lebih toleran)
MAX_PAGES       = 400   # absolute safety cap: 10 review/page × 400 = 4000 review

# Nama bulan Indonesia → angka
_ID_MONTHS = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "agustus": 8,
    "september": 9, "oktober": 10, "november": 11, "desember": 12,
}

# ── Global scrape lock — prevents concurrent scrapes of the same URL ──────────
_scrape_locks: dict[str, asyncio.Lock] = {}


def _get_lock(url: str) -> asyncio.Lock:
    """Return (or create) a per-URL async lock."""
    if url not in _scrape_locks:
        _scrape_locks[url] = asyncio.Lock()
    return _scrape_locks[url]


# ──────────────────────────────────────────────
# 1.1 HEADLESS CRAWLER — Playwright Async
# ──────────────────────────────────────────────

async def _fetch_page_html(browser, url: str) -> str:
    """
    Open a single URL in a fresh Playwright browser context and return
    the fully JS-rendered HTML.

    Wraps _fetch_with_retry so each call benefits from auto-retry.
    """
    return await _fetch_with_retry(browser, url)


# ──────────────────────────────────────────────
# 1.2 RESILIENT SCRAPING — Auto-Retry + Backoff
# ──────────────────────────────────────────────

async def _fetch_with_retry(browser, url: str, attempt: int = 0) -> str:
    """
    Fetch a URL using Playwright with automatic retry on failure.

    Strategy:
      - Up to MAX_RETRIES (3) attempts total
      - Exponential backoff: 2s → 4s → 8s between retries
      - On every attempt, a fresh browser context is created and closed

    Raises the last exception if all retries are exhausted.
    """
    context = None
    try:
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            await page.goto(url, timeout=30_000, wait_until="domcontentloaded")
        except PlaywrightTimeoutError:
            # Page partially loaded — still try to get content
            print(f"[Scraper] Timeout navigating to {url} — proceeding with partial content.")

        # Wait for JS to hydrate the review cards
        await page.wait_for_timeout(JS_WAIT_MS)

        html = await page.content()
        return html

    except Exception as exc:
        if attempt < MAX_RETRIES - 1:
            wait_seconds = 2 ** (attempt + 1)   # 2s, 4s, 8s
            print(
                f"[Scraper] ⚠ Retry {attempt + 1}/{MAX_RETRIES - 1} "
                f"in {wait_seconds}s for {url} — {exc}"
            )
            await asyncio.sleep(wait_seconds)
            return await _fetch_with_retry(browser, url, attempt + 1)
        print(f"[Scraper] ✗ All {MAX_RETRIES} attempts failed for {url}: {exc}")
        raise

    finally:
        if context:
            await context.close()


# ──────────────────────────────────────────────
# 1.3 TIME-BASED FILTERING — Date Parsing
# ──────────────────────────────────────────────

def _parse_review_date(date_str: str) -> datetime | None:
    """
    Parse a review date string from Female Daily into a datetime object.

    Handles multiple formats:
      Relative (Indonesian): "2 hari yang lalu", "1 bulan lalu", "3 jam lalu"
      Relative (English):    "2 days ago", "1 month ago", "3 hours ago"
      Absolute (Indonesian): "2 Juni 2024", "02 Januari 2023"
      Absolute (English):    "June 2, 2024", "02/06/2024", "2024-06-02"

    Returns None if the format is unrecognised.
    """
    if not date_str:
        return None

    s = date_str.strip().lower()
    now = datetime.now()

    # ── Relative: Indonesian ──────────────────────────────────
    rel_id = re.match(
        r"(\d+)\s+(detik|menit|jam|hari|minggu|bulan|tahun)\s*(yang lalu|lalu)?", s
    )
    if rel_id:
        amount = int(rel_id.group(1))
        unit   = rel_id.group(2)
        deltas = {
            "detik": timedelta(seconds=amount),
            "menit": timedelta(minutes=amount),
            "jam":   timedelta(hours=amount),
            "hari":  timedelta(days=amount),
            "minggu":timedelta(weeks=amount),
            "bulan": timedelta(days=amount * 30),
            "tahun": timedelta(days=amount * 365),
        }
        return now - deltas.get(unit, timedelta(0))

    # ── Relative: English ────────────────────────────────────
    rel_en = re.match(
        r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", s
    )
    if rel_en:
        amount = int(rel_en.group(1))
        unit   = rel_en.group(2)
        deltas = {
            "second": timedelta(seconds=amount),
            "minute": timedelta(minutes=amount),
            "hour":   timedelta(hours=amount),
            "day":    timedelta(days=amount),
            "week":   timedelta(weeks=amount),
            "month":  timedelta(days=amount * 30),
            "year":   timedelta(days=amount * 365),
        }
        return now - deltas.get(unit, timedelta(0))

    # ── Absolute: "2 Juni 2024" / "02 Januari 2023" ──────────
    abs_id = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", s)
    if abs_id:
        day, month_str, year = abs_id.group(1), abs_id.group(2), abs_id.group(3)
        month_num = _ID_MONTHS.get(month_str)
        if month_num:
            try:
                return datetime(int(year), month_num, int(day))
            except ValueError:
                pass

    # ── Absolute: "June 2, 2024" ─────────────────────────────
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            pass

    # ── Absolute: ISO / numeric ───────────────────────────────
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            pass

    return None   # format tidak dikenal


def _is_within_days(date_str: str, days: int | None) -> bool:
    """
    Return True if the review falls within the last `days` days.

    If `days` is None (no filter), always returns True.
    If the date cannot be parsed, returns True (include by default — safer).
    """
    if days is None:
        return True
    dt = _parse_review_date(date_str)
    if dt is None:
        return True   # fail-open: unknown date format → include review
    cutoff = datetime.now() - timedelta(days=days)
    return dt >= cutoff


# ──────────────────────────────────────────────
# HTML EXTRACTORS
# ──────────────────────────────────────────────

def _extract_reviews_from_page(
    soup: BeautifulSoup,
    days: int | None = None,
    seen_hashes: set | None = None,
) -> tuple[list[dict], bool]:
    """
    Extract all review cards present on a single page.

    Targets inside each div.review-card:
        .text-content  → review body text
        .review-date   → publication date
        .profile-name / .username → reviewer name

    Parameters
    ----------
    seen_hashes : set | None
        A mutable set of content hashes already collected across all pages.
        Any review whose hash is already in this set is skipped (dedup).
        This is the primary guard against Female Daily serving the same
        reviews on every `?page=N` URL (client-side pagination).

    Returns (reviews, stop_early):
        reviews    — list of new, deduplicated review dicts
        stop_early — True when the time-window cutoff has been passed OR
                     when every card on this page was a duplicate (signal
                     to stop pagination)
    """
    if seen_hashes is None:
        seen_hashes = set()

    reviews      = []
    stop_early   = False
    all_dupes    = True   # assume all dupes until proven otherwise

    for card in soup.select("div.review-card"):
        text_el   = card.select_one(".text-content")
        date_el   = card.select_one(".review-date")
        author_el = card.select_one(".profile-name") or card.select_one(".username")

        review_text = text_el.get_text(" ", strip=True) if text_el else None
        if not review_text:
            continue

        # Deduplication check
        content_hash = hash(review_text)
        if content_hash in seen_hashes:
            continue   # already collected this review on a previous page
        all_dupes = False   # at least one card is new

        date_str = date_el.get_text(strip=True) if date_el else "Unknown Date"

        # Time-based filter
        if not _is_within_days(date_str, days):
            stop_early = True   # this review is too old → signal caller to stop
            continue

        seen_hashes.add(content_hash)
        reviews.append({
            "content"   : review_text,
            "date"      : date_str,
            "author"    : author_el.get_text(strip=True) if author_el else "FemaleDaily User",
            "isVerified": True,
        })

    # If every card on this page was a duplicate, the site is looping — stop.
    if all_dupes and soup.select("div.review-card"):
        print("[Scraper] All reviews on this page are duplicates — pagination loop detected.")
        stop_early = True

    return reviews, stop_early


def _extract_product_meta(soup: BeautifulSoup) -> tuple[str, str, str | None, str | None]:
    """
    Extract (product_name, product_brand, product_image, product_shade) from page 1 HTML.
    Returns safe defaults when elements are not found.
    """
    name_tag  = soup.select_one('[class*="product-name"]') or soup.find("h1")
    brand_tag = soup.select_one('[class*="product-brand"]') or soup.select_one('[class*="brand-name"]')
    img_tag   = soup.find("img", src=re.compile(r"image\.femaledaily\.com.*/prod-pics/"))

    # Shade: cari elemen dengan class yang mengandung "product-shade"
    shade_tag = soup.select_one('[class*="product-shade"]')

    product_name  = name_tag.get_text(strip=True)  if name_tag  else "Unknown Product"
    product_brand = brand_tag.get_text(strip=True) if brand_tag else "Unknown Brand"
    product_shade = shade_tag.get_text(strip=True) if shade_tag else None

    product_image = None
    if img_tag and img_tag.get("src"):
        src = img_tag["src"]
        product_image = ("https:" + src) if src.startswith("//") else src

    print(f"[Scraper] Shade: {product_shade!r}")
    return product_name, product_brand, product_image, product_shade


# ──────────────────────────────────────────────
# MAIN SCRAPER — async
# ──────────────────────────────────────────────

async def scrape_product_info(url: str, days: int | None = None) -> dict:
    """
    Scrape product metadata and all paginated reviews from a Female Daily URL.

    Parameters
    ----------
    url : str
        Full Female Daily product URL.
    days : int | None
        If set, only reviews posted within the last `days` days are included.
        e.g. days=7  → last 7 days only
             days=30 → last 30 days
             days=None → no filter (default)

    Features
    --------
    - Headless Playwright (async) — handles JS-rendered pages  [1.1]
    - Auto-Retry 3x with exponential backoff per page          [1.2]
    - Time-based filtering via `days` parameter                [1.3]
    - Stops early when reviews older than the window appear
    - Hard-caps at MAX_PAGES to prevent infinite loops

    Returns
    -------
    dict with keys: product_name, product_brand, product_image,
                    product_url, reviews_raw
    """
    all_reviews:   list[dict] = []
    product_name  = "Unknown Product"
    product_brand = "Unknown Brand"
    product_image = None
    product_shade = None
    empty_streak  = 0
    seen_hashes:  set = set()   # dedup guard across all pages

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        try:
            for page_num in range(1, MAX_PAGES + 1):
                paged_url = f"{url}?page={page_num}"
                print(f"[Scraper] Fetching page {page_num}: {paged_url}")

                try:
                    html = await _fetch_page_html(browser, paged_url)
                except Exception as exc:
                    print(f"[Scraper] ✗ Giving up on page {page_num} after retries: {exc}")
                    break

                soup = BeautifulSoup(html, "html.parser")

                # Metadata — extracted once from the first page
                if page_num == 1:
                    product_name, product_brand, product_image, product_shade = _extract_product_meta(soup)
                    print(f"[Scraper] Product: {product_brand} – {product_name}")

                page_reviews, stop_early = _extract_reviews_from_page(
                    soup, days, seen_hashes
                )

                if not page_reviews:
                    empty_streak += 1
                    print(
                        f"[Scraper] Page {page_num} yielded no new reviews "
                        f"(streak={empty_streak}/{MAX_EMPTY_PAGES})."
                    )
                    if empty_streak >= MAX_EMPTY_PAGES or stop_early:
                        print("[Scraper] Stopping pagination.")
                        break
                else:
                    empty_streak = 0
                    all_reviews.extend(page_reviews)
                    print(
                        f"[Scraper] Page {page_num}: "
                        f"{len(page_reviews)} new reviews (total={len(all_reviews)})"
                    )
                    if stop_early:
                        print(
                            f"[Scraper] Reviews older than {days} days detected — "
                            "stopping early."
                        )
                        break

                await asyncio.sleep(REQUEST_DELAY)

        finally:
            await browser.close()

    # Attach sequential IDs
    for i, rev in enumerate(all_reviews):
        rev["id"] = str(i + 1)

    filter_note = f" (filter: last {days} days)" if days else ""
    print(
        f"[Scraper] Done{filter_note} — "
        f"{len(all_reviews)} reviews collected for '{product_name}'."
    )

    return {
        "product_name" : product_name,
        "product_brand": product_brand,
        "product_image": product_image,
        "product_shade": product_shade,
        "product_url"  : url,
        "reviews_raw"  : all_reviews,
    }
"""
Latency Test — Scraping, Inference, dan DB
===========================================
Mengukur waktu per fase (scrape / inference / NSS / DB) untuk cold run,
dan waktu ambil data dari MongoDB untuk cache run.

Cara pakai:
  1. Pastikan backend berjalan di http://localhost:8000
  2. Pastikan MongoDB bersih (tidak ada produk dari URL yang sama)
  3. Jalankan: python test_latency.py
  4. Hasil tersimpan di latency_results.csv
"""

import csv
import time
import sys
from datetime import datetime
from pathlib import Path

import requests

# ── Konfigurasi ───────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8000"
OUTPUT_CSV = "latency_results.csv"

# Timeout per request (detik) — cold run Tony Moly bisa > 20 menit
COLD_TIMEOUT  = 3600   # 1 jam untuk produk dengan ribuan ulasan
CACHE_TIMEOUT = 30

PRODUCTS = [
    {
        "produk":        "Pixy Hyperlast Glazed Lip Vinyl 03",
        "url":           "https://reviews.femaledaily.com/products/lips/lipstick/pixy/hyperlast-glazed-lip-vinyl-03-charming-pink",
        "n_ulasan_klaim": 29,
    },
    {
        "produk":        "ESQA Lip Gloss 46",
        "url":           "https://reviews.femaledaily.com/products/lips/lip-gloss/esqa/esqa-lip-gloss-46",
        "n_ulasan_klaim": 96,
    },
    {
        "produk":        "Peripera Ink Velvet 05 Inktude Rose",
        "url":           "https://reviews.femaledaily.com/products/lips/lip-stain-tint/peripera/ink-velvet-05-inktude-rose",
        "n_ulasan_klaim": 287,
    },
    {
        "produk":        "NYX Soft Matte Lip Cream San Paulo 1",
        "url":           "https://reviews.femaledaily.com/products/lips/lipstick/nyx/soft-matte-lip-cream-san-paulo-1",
        "n_ulasan_klaim": 462,
    },
    {
        "produk":        "Laneige Lip Sleeping Mask Grapefruit",
        "url":           "https://reviews.femaledaily.com/products/lips/lip-balm-treatments/laneige/lip-sleeping-mask-grapefruit",
        "n_ulasan_klaim": 675,
    },
    {
        "produk":        "Tony Moly Delight",
        "url":           "https://reviews.femaledaily.com/products/lips/lip-stain-tint/tony-moly/delight",
        "n_ulasan_klaim": 2286,
    },
]

FIELDNAMES = [
    "produk", "url", "n_ulasan_klaim", "tipe", "percobaan_ke",
    "scrape_time_sec", "infer_time_sec", "nss_time_sec", "db_save_time_sec",
    "total_time_sec", "db_fetch_time_sec", "n_ulasan_aktual", "timestamp",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def _empty_row(produk: dict, tipe: str, percobaan_ke: int) -> dict:
    return {
        "produk":          produk["produk"],
        "url":             produk["url"],
        "n_ulasan_klaim":  produk["n_ulasan_klaim"],
        "tipe":            tipe,
        "percobaan_ke":    percobaan_ke,
        "scrape_time_sec": None,
        "infer_time_sec":  None,
        "nss_time_sec":    None,
        "db_save_time_sec":None,
        "total_time_sec":  None,
        "db_fetch_time_sec":None,
        "n_ulasan_aktual": None,
        "timestamp":       datetime.now().isoformat(),
    }


# ── Cold run ──────────────────────────────────────────────────────────────────

def run_cold(produk: dict) -> tuple[dict, str | None]:
    """
    POST /api/scrape — jalankan full pipeline dan catat timing dari response.
    Kembalikan (row_dict, product_id).
    """
    row = _empty_row(produk, "cold", 1)
    product_id = None

    _log(f"[COLD] Mulai scrape: {produk['produk']} ...")
    t_wall_start = time.perf_counter()

    try:
        res = requests.post(
            f"{BASE_URL}/api/scrape",
            json={"url": produk["url"]},
            timeout=COLD_TIMEOUT,
        )
    except requests.exceptions.Timeout:
        _log(f"[COLD] TIMEOUT setelah {COLD_TIMEOUT}s — {produk['produk']}")
        row["timestamp"] = datetime.now().isoformat()
        return row, None
    except requests.exceptions.RequestException as exc:
        _log(f"[COLD] Request error: {exc}")
        row["timestamp"] = datetime.now().isoformat()
        return row, None

    t_wall_end = time.perf_counter()
    wall_time  = round(t_wall_end - t_wall_start, 2)

    if res.status_code == 409:
        detail = res.json().get("detail", {})
        if isinstance(detail, dict):
            product_id = detail.get("product_id")
            _log(
                f"[COLD] Produk sudah ada di DB (409). "
                f"product_id={product_id}. "
                f"Hapus dulu dari MongoDB sebelum cold run."
            )
        else:
            _log(f"[COLD] 409: {detail}")
        row["timestamp"] = datetime.now().isoformat()
        return row, product_id

    if res.status_code != 200:
        _log(f"[COLD] HTTP {res.status_code}: {res.text[:200]}")
        row["timestamp"] = datetime.now().isoformat()
        return row, None

    data = res.json()
    timing = data.get("_timing", {})
    product_id = data.get("_id")

    row["scrape_time_sec"]  = timing.get("scrape_sec")
    row["infer_time_sec"]   = timing.get("infer_sec")
    row["nss_time_sec"]     = timing.get("nss_sec")
    row["db_save_time_sec"] = timing.get("db_save_sec")
    row["total_time_sec"]   = timing.get("total_sec") or wall_time
    row["n_ulasan_aktual"]  = timing.get("n_reviews") or data.get("total_reviews")
    row["timestamp"]        = datetime.now().isoformat()

    _log(
        f"[COLD] Selesai: {produk['produk']} — "
        f"total={row['total_time_sec']}s, "
        f"scrape={row['scrape_time_sec']}s, "
        f"infer={row['infer_time_sec']}s, "
        f"n_ulasan={row['n_ulasan_aktual']}"
    )
    return row, product_id


# ── Cache run ─────────────────────────────────────────────────────────────────

def run_cache(produk: dict, product_id: str, percobaan_ke: int) -> dict:
    """
    GET /api/products/{id} — ukur waktu ambil dari MongoDB.
    """
    row = _empty_row(produk, "cache", percobaan_ke)

    if not product_id:
        _log(f"[CACHE-{percobaan_ke}] Tidak ada product_id — skip.")
        return row

    _log(f"[CACHE-{percobaan_ke}] GET /api/products/{product_id} ...")

    try:
        t0  = time.perf_counter()
        res = requests.get(
            f"{BASE_URL}/api/products/{product_id}",
            timeout=CACHE_TIMEOUT,
        )
        elapsed = round(time.perf_counter() - t0, 3)
    except requests.exceptions.RequestException as exc:
        _log(f"[CACHE-{percobaan_ke}] Error: {exc}")
        return row

    if res.status_code != 200:
        _log(f"[CACHE-{percobaan_ke}] HTTP {res.status_code}")
        return row

    row["db_fetch_time_sec"] = elapsed
    row["n_ulasan_aktual"]   = res.json().get("total_reviews")
    row["timestamp"]         = datetime.now().isoformat()

    _log(f"[CACHE-{percobaan_ke}] Selesai — {elapsed}s")
    return row


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    # Cek backend aktif
    try:
        requests.get(f"{BASE_URL}/api/products", timeout=5)
    except requests.exceptions.ConnectionError:
        print(
            f"ERROR: Tidak dapat terhubung ke {BASE_URL}.\n"
            "Pastikan backend berjalan sebelum menjalankan script ini."
        )
        sys.exit(1)

    output_path = Path(OUTPUT_CSV)
    write_header = not output_path.exists()

    with open(output_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()

        for produk in PRODUCTS:
            _log(f"{'=' * 60}")
            _log(f"Produk: {produk['produk']} (klaim {produk['n_ulasan_klaim']} ulasan)")
            _log(f"{'=' * 60}")

            # Cold run
            cold_row, product_id = run_cold(produk)
            writer.writerow(cold_row)
            f.flush()

            if not product_id:
                _log(f"Tidak ada product_id — skip cache runs untuk {produk['produk']}.")
                continue

            # Cache run x3
            for i in range(1, 4):
                cache_row = run_cache(produk, product_id, i)
                writer.writerow(cache_row)
                f.flush()

    _log(f"Selesai. Hasil disimpan di: {output_path.resolve()}")


if __name__ == "__main__":
    main()

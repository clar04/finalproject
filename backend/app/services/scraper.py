import requests
from bs4 import BeautifulSoup
import random

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ── Mock reviews untuk development (sebelum model real) ─────
MOCK_REVIEW_POOL = [
    ("Pigmentasinya luar biasa, satu swipe langsung kelihatan!",       "positive", "pigmentation"),
    ("Warnanya sangat bagus dan sesuai foto di website.",              "positive", "pigmentation"),
    ("Pigmentasinya agak sheer, perlu beberapa layer.",                "negative", "pigmentation"),
    ("Warna tidak sesuai ekspektasi, terlalu pudar.",                  "negative", "pigmentation"),
    ("Tahan lama banget, dari pagi sampai malam masih ada.",           "positive", "longevity"),
    ("Awet banget dipakai seharian meski makan dan minum.",            "positive", "longevity"),
    ("Mudah luntur setelah makan, harus retouch terus.",               "negative", "longevity"),
    ("Tidak tahan lama, habis 2 jam sudah hilang warnanya.",           "negative", "longevity"),
    ("Teksturnya sangat halus dan nyaman di bibir.",                   "positive", "texture"),
    ("Tidak terasa berat, ringan banget dipakai seharian.",            "positive", "texture"),
    ("Teksturnya agak kering, cocok tapi tidak untuk bibir kering.",   "neutral",  "texture"),
    ("Sedikit berminyak di awal tapi lama-lama nyaman.",               "neutral",  "texture"),
    ("Bikin bibir kering dan pecah-pecah setelah dipakai lama.",       "negative", "texture"),
    ("Sangat melembapkan, bibir terasa lembut seharian.",              "positive", "hydration"),
    ("Tidak bikin bibir kering meski formula matte.",                  "positive", "hydration"),
    ("Cukup melembapkan untuk lip cream matte.",                       "neutral",  "hydration"),
    ("Bikin bibir kering, perlu pakai lip balm dulu.",                 "negative", "hydration"),
    ("Harganya sangat worth it untuk kualitas sebagus ini!",           "positive", "price"),
    ("Terjangkau banget, kualitas premium harga drugstore.",           "positive", "price"),
    ("Harga standar, sesuai dengan kualitasnya.",                      "neutral",  "price"),
]


def scrape_product_info(url: str) -> dict:
    """
    Scrape info produk dari URL femaledaily.
    Saat ini mengembalikan data mock untuk development.
    Ganti implementasi ini setelah model real selesai.
    """
    try:
        # Coba scrape nama produk dari URL
        response = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(response.text, "html.parser")

        # Coba ambil nama produk (selector disesuaikan dengan struktur femaledaily)
        name_tag = soup.find("h1", class_="product-name") or soup.find("h1")
        product_name = name_tag.get_text(strip=True) if name_tag else "Unknown Product"

        brand_tag = soup.find("a", class_="brand-name") or soup.find("span", class_="brand")
        product_brand = brand_tag.get_text(strip=True) if brand_tag else "Unknown Brand"

    except Exception:
        # Fallback ke mock kalau scraping gagal
        product_name  = "Product (Mock)"
        product_brand = "Brand (Mock)"

    # Generate mock reviews
    mock_reviews = []
    sampled = random.sample(MOCK_REVIEW_POOL, min(10, len(MOCK_REVIEW_POOL)))
    for i, (content, sentiment, aspect) in enumerate(sampled):
        mock_reviews.append({
            "id":         str(i + 1),
            "author":     f"User{random.randint(100, 999)}",
            "date":       "Mei 2026",
            "content":    content,
            "sentiment":  sentiment,
            "aspect":     aspect,
            "isVerified": random.choice([True, False]),
        })

    return {
        "product_name":  product_name,
        "product_brand": product_brand,
        "product_url":   url,
        "reviews_raw":   mock_reviews,  # nanti diganti hasil scraping real
    }
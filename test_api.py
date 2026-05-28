import requests

try:
    print("Sending request...")
    res = requests.post("http://127.0.0.1:8000/api/scrape", json={"url": "https://reviews.femaledaily.com/products/lips/lip-cream/somethinc/idol-blurry-soft-lip-matte"})
    print("Status:", res.status_code)
    data = res.json()
    print("Keys:", data.keys())
    print("Image:", data.get("product_image"))
except Exception as e:
    print("Error:", e)

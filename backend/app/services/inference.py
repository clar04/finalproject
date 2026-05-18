"""
inference.py
------------
Saat ini menggunakan label dari scraper (mock).
Setelah model .pt selesai ditraining, ganti fungsi `run_inference`
dengan load IndoBERT + CABiLSTM dan forward pass sungguhan.
"""

from app.models.product import ABSAAspect, SentimentDistribution, Review


def run_inference(reviews_raw: list[dict]) -> list[dict]:
    """
    Input : list of { id, author, date, content, sentiment, aspect, isVerified }
    Output: list yang sama (sentiment sudah ada dari mock)
    
    TODO: Ganti dengan:
        1. Tokenisasi pakai IndoBERT tokenizer
        2. Forward pass ke model CABiLSTM-IndoBERT
        3. Map output logits → label (positive/negative/neutral)
    """
    # Mock: langsung pakai label yang sudah ada dari scraper
    return reviews_raw


def calculate_nss_and_breakdown(reviews: list[dict]) -> dict:
    """
    Hitung NSS dan breakdown dari hasil inference.
    
    NSS = (%positive - %negative) per aspek
    Range: -100 sampai +100
    """
    ASPECTS = ["pigmentation", "longevity", "texture", "hydration", "price"]

    # ── Per-aspek breakdown ──────────────────────────────────
    absa_aspects = []
    nss_scores   = {}

    for aspect in ASPECTS:
        aspect_reviews = [r for r in reviews if r.get("aspect") == aspect]
        if not aspect_reviews:
            continue

        pos = sum(1 for r in aspect_reviews if r["sentiment"] == "positive")
        neg = sum(1 for r in aspect_reviews if r["sentiment"] == "negative")
        neu = sum(1 for r in aspect_reviews if r["sentiment"] == "neutral")
        total = pos + neg + neu

        nss = round(((pos - neg) / total) * 100) if total > 0 else 0

        absa_aspects.append(ABSAAspect(
            aspect=aspect, positive=pos, negative=neg, neutral=neu, nss=nss
        ))
        nss_scores[aspect] = nss

    # ── Overall distribution ─────────────────────────────────
    total_pos = sum(1 for r in reviews if r["sentiment"] == "positive")
    total_neg = sum(1 for r in reviews if r["sentiment"] == "negative")
    total_neu = sum(1 for r in reviews if r["sentiment"] == "neutral")
    total_all = len(reviews)

    overall_nss = round(
        ((total_pos - total_neg) / total_all) * 100
    ) if total_all > 0 else 0

    sentiment_distribution = SentimentDistribution(
        positive=total_pos,
        negative=total_neg,
        neutral=total_neu,
    )

    return {
        "overall_nss":            overall_nss,
        "nss_scores":             nss_scores,
        "absa_aspects":           [a.model_dump() for a in absa_aspects],
        "sentiment_distribution": sentiment_distribution.model_dump(),
    }
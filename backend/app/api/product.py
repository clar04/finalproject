from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId


# ── Helper untuk ObjectId ────────────────────────────────────
class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


# ── Sub-schemas ───────────────────────────────────────────────
class NSSScores(BaseModel):
    pigmentation: Optional[float] = None
    longevity:    Optional[float] = None
    texture:      Optional[float] = None
    hydration:    Optional[float] = None
    price:        Optional[float] = None


class SentimentDistribution(BaseModel):
    positive: int = 0
    negative: int = 0
    neutral:  int = 0


class ABSAAspect(BaseModel):
    aspect:            str
    positive:          int = 0
    negative:          int = 0
    neutral:           int = 0
    nss:               Optional[float] = None   
    raw_nss:           Optional[float] = None   
    review_count:      int = 0
    is_low_count:      bool = False
    low_count_warning: Optional[str] = None


class Review(BaseModel):
    id:          str
    author:      str
    date:        str
    content:     str
    sentiment:   str   # "positive" | "negative" | "neutral"
    aspect:      str
    isVerified:  bool = False


# ── Main Product schema ───────────────────────────────────────
class ProductInDB(BaseModel):
    id:                      Optional[str] = Field(None, alias="_id")
    product_name:            str
    product_brand:           Optional[str] = None
    product_price:           Optional[float] = None
    product_url:             Optional[str] = None
    rating:                  Optional[float] = None
    total_reviews:           int = 0
    overall_nss:             Optional[float] = None   
    overall_raw_nss:         Optional[float] = None   
    overall_is_low_confidence: bool = False
    overall_low_count_warning: Optional[str] = None
    isTrending:              bool = False
    nss_scores:              NSSScores = NSSScores()
    sentiment_distribution:  SentimentDistribution = SentimentDistribution()
    absa_aspects:            list[ABSAAspect] = []
    reviews:                 list[Review] = []

    class Config:
        populate_by_name = True


# ── Request schemas ───────────────────────────────────────────
class ScrapeRequest(BaseModel):
    url: str

class CompareRequest(BaseModel):
    id1: str
    id2: str
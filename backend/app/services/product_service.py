# pyrefly: ignore [missing-import]
from bson import ObjectId
from app.db.mongodb import get_database


def _serialize(doc: dict) -> dict:
    """Convert MongoDB _id ObjectId to string."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def get_all_products() -> list[dict]:
    db = get_database()
    cursor = db["products"].find({}, {"reviews": 0})  # exclude heavy reviews list
    results = []
    async for doc in cursor:
        results.append(_serialize(doc))
    return results


async def get_product_by_id(product_id: str) -> dict | None:
    db = get_database()
    try:
        oid = ObjectId(product_id)
    except Exception:
        return None
    doc = await db["products"].find_one({"_id": oid})
    return _serialize(doc) if doc else None


async def save_product(product_data: dict) -> str:
    """Insert or replace a product document. Returns the inserted _id as string."""
    db = get_database()
    url = product_data.get("product_url")
    if url:
        # Upsert by URL so re-scraping the same product updates instead of duplicates
        result = await db["products"].find_one_and_replace(
            {"product_url": url},
            product_data,
            upsert=True,
            return_document=True,
        )
        return str(result["_id"]) if result else ""
    else:
        result = await db["products"].insert_one(product_data)
        return str(result.inserted_id)

async def search_products(query: str) -> list[dict]:
    db = get_database()
    regex = {"$regex": query, "$options": "i"}
    cursor = db["products"].find(
        {"$or": [{"product_name": regex}, {"product_brand": regex}]},
        {"reviews": 0}
    ).limit(10)
    results = []
    async for doc in cursor:
        results.append(_serialize(doc))
    return results


async def get_product_by_url(url: str) -> dict | None:
    """Return the stored product document for a given product_url, or None."""
    db = get_database()
    doc = await db["products"].find_one({"product_url": url}, {"reviews": 0})
    return _serialize(doc) if doc else None

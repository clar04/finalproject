from fastapi import APIRouter, HTTPException
from app.models.product import CompareRequest
from app.services.product_service import get_product_by_id

router = APIRouter(prefix="/api", tags=["compare"])


@router.post("/compare")
async def compare_products(body: CompareRequest):
    """
    Komparasi 2 produk by MongoDB _id.
    Kedua produk harus sudah ada di database
    (sudah pernah di-scrape sebelumnya).
    """
    if body.id1 == body.id2:
        raise HTTPException(400, "Pilih dua produk yang berbeda")

    # Ambil kedua produk dari MongoDB
    product1 = await get_product_by_id(body.id1)
    product2 = await get_product_by_id(body.id2)

    if not product1:
        raise HTTPException(404, f"Produk 1 (id: {body.id1}) tidak ditemukan")
    if not product2:
        raise HTTPException(404, f"Produk 2 (id: {body.id2}) tidak ditemukan")

    return {
        "product1": product1,
        "product2": product2,
    }
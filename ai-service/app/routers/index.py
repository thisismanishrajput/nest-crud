from fastapi import APIRouter

from app.schemas.product import BulkProductsForIndex, ProductForIndex
from app.services.chroma_service import chroma_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/index", tags=["index"])


@router.post("/product")
def index_product(product: ProductForIndex):
    return rag_service.index_product(product)


@router.post("/products")
def index_products(payload: BulkProductsForIndex):
    return rag_service.index_products(payload.products)


@router.delete("/product/{product_id}")
def delete_product(product_id: str):
    return rag_service.delete_product(product_id)


@router.get("/stats")
def index_stats():
    return {"indexed_products": chroma_service.count_products()}

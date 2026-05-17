from fastapi import APIRouter

from app.schemas.query import (
    ProductSearchRequest,
    ProductSearchResponse,
    RagQueryRequest,
    RagQueryResponse,
)
from app.services.rag_service import rag_service

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/search-products", response_model=ProductSearchResponse)
def search_products(payload: ProductSearchRequest):
    results = rag_service.search_products(
        query=payload.query,
        limit=payload.limit,
        category=payload.category,
        max_price=payload.max_price,
        in_stock_only=payload.in_stock_only,
    )
    return ProductSearchResponse(query=payload.query, results=results)


@router.post("/query", response_model=RagQueryResponse)
def query(payload: RagQueryRequest):
    response = rag_service.answer_product_query(
        query=payload.query,
        limit=payload.limit,
        category=payload.category,
        max_price=payload.max_price,
        in_stock_only=payload.in_stock_only,
    )
    return RagQueryResponse(query=payload.query, **response)

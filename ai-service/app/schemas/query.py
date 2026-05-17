from typing import Optional

from pydantic import BaseModel, Field


class ProductSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: Optional[int] = Field(default=None, ge=1, le=20)
    category: Optional[str] = None
    max_price: Optional[float] = None
    in_stock_only: bool = True


class ProductSearchResult(BaseModel):
    mongo_id: str
    product_id: str
    title: str
    category: str
    price: float
    discount_price: float
    stock: int
    rating: float
    distance: float
    document: str


class ProductSearchResponse(BaseModel):
    query: str
    results: list[ProductSearchResult]


class RagQueryRequest(ProductSearchRequest):
    pass


class RagQueryResponse(BaseModel):
    query: str
    answer: str
    product_ids: list[str]
    results: list[ProductSearchResult]

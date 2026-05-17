from typing import Optional

from pydantic import BaseModel, Field


class ProductForIndex(BaseModel):
    id: str = Field(..., description="MongoDB _id as a string")
    product_id: Optional[str] = Field(default=None, description="Public product id")
    title: str
    description: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    price: float
    discount_price: Optional[float] = None
    stock: int = 0
    rating: Optional[float] = None
    tags: list[str] = []
    status: Optional[str] = None

    def to_search_text(self) -> str:
        parts = [
            f"Product: {self.title}",
            f"Brand: {self.brand or 'No brand'}",
            f"Description: {self.description or 'No description'}",
            f"Category: {self.category or 'Uncategorized'}",
            f"Sub category: {self.sub_category or 'No sub category'}",
            f"Tags: {', '.join(self.tags) if self.tags else 'No tags'}",
            f"Price: {self.price}",
            f"Discount price: {self.discount_price or 'No discount'}",
            f"Stock: {'Available' if self.stock > 0 else 'Out of stock'}",
            f"Rating: {self.rating or 'No rating yet'}",
            f"Status: {self.status or 'unknown'}",
        ]
        return "\n".join(parts)

    def to_metadata(self) -> dict:
        return {
            "mongo_id": self.id,
            "product_id": self.product_id or "",
            "title": self.title,
            "brand": self.brand or "",
            "category": self.category or "",
            "price": self.price,
            "discount_price": self.discount_price or self.price,
            "stock": self.stock,
            "rating": self.rating or 0,
            "status": self.status or "",
        }


class BulkProductsForIndex(BaseModel):
    products: list[ProductForIndex]

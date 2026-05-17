from typing import Optional

from app.config import settings
from app.schemas.query import ProductSearchResult
from app.schemas.product import ProductForIndex
from app.services.chroma_service import chroma_service


class RagService:
    def index_product(self, product: ProductForIndex) -> dict:
        chroma_service.upsert_product(
            product_id=product.id,
            document=product.to_search_text(),
            metadata=product.to_metadata(),
        )
        return {"message": "Product indexed", "product_id": product.id}

    def index_products(self, products: list[ProductForIndex]) -> dict:
        for product in products:
            self.index_product(product)
        return {"message": "Products indexed", "count": len(products)}

    def delete_product(self, product_id: str) -> dict:
        chroma_service.delete_product(product_id)
        return {"message": "Product removed from vector index", "product_id": product_id}

    def search_products(
        self,
        query: str,
        limit: Optional[int],
        category: Optional[str],
        max_price: Optional[float],
        in_stock_only: bool,
    ) -> list[ProductSearchResult]:
        rows = chroma_service.search_products(
            query=query,
            limit=limit or settings.search_result_limit,
            category=category,
            max_price=max_price,
            in_stock_only=in_stock_only,
        )

        results = []
        for row in rows:
            if row["distance"] > settings.search_max_distance:
                continue

            metadata = row["metadata"]
            results.append(
                ProductSearchResult(
                    mongo_id=metadata["mongo_id"],
                    product_id=metadata["product_id"],
                    title=metadata["title"],
                    category=metadata["category"],
                    price=metadata["price"],
                    discount_price=metadata["discount_price"],
                    stock=metadata["stock"],
                    rating=metadata["rating"],
                    distance=row["distance"],
                    document=row["document"],
                )
            )
        return results

    def answer_product_query(
        self,
        query: str,
        limit: Optional[int],
        category: Optional[str],
        max_price: Optional[float],
        in_stock_only: bool,
    ) -> dict:
        results = self.search_products(
            query=query,
            limit=limit,
            category=category,
            max_price=max_price,
            in_stock_only=in_stock_only,
        )

        if not results:
            return {
                "answer": f'Sorry, we do not have products related to "{query}" right now.',
                "product_ids": [],
                "results": [],
            }

        lines = ["Here are the best matching products:"]
        product_ids = []
        for index, product in enumerate(results, start=1):
            product_ids.append(product.mongo_id)
            lines.append(
                f"{index}. {product.title} - price {product.discount_price}, "
                f"category {product.category}, stock {product.stock}"
            )

        return {
            "answer": "\n".join(lines),
            "product_ids": product_ids,
            "results": results,
        }


rag_service = RagService()

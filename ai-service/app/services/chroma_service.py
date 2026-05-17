import os
from typing import Optional

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from app.config import settings
from app.services.embedding_service import get_embedding_function


class ChromaService:
    def __init__(self) -> None:
        self._client = None
        self._products = None

    @property
    def client(self):
        if self._client is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self._client = chromadb.PersistentClient(
                path=settings.chroma_path,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._client

    @property
    def products(self):
        if self._products is None:
            self._products = self.client.get_or_create_collection(
                name=settings.product_collection,
                embedding_function=get_embedding_function(),
                metadata={"description": "Product vectors for ecommerce semantic search"},
            )
        return self._products

    def upsert_product(self, product_id: str, document: str, metadata: dict) -> None:
        self.products.upsert(
            ids=[product_id],
            documents=[document],
            metadatas=[metadata],
        )

    def delete_product(self, product_id: str) -> None:
        self.products.delete(ids=[product_id])

    def search_products(
        self,
        query: str,
        limit: int,
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        in_stock_only: bool = True,
    ) -> list[dict]:
        where = self._build_where(category, max_price, in_stock_only)
        result = self.products.query(
            query_texts=[query],
            n_results=limit,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        return self._flatten_query_result(result)

    def count_products(self) -> int:
        return self.products.count()

    def _build_where(
        self,
        category: Optional[str],
        max_price: Optional[float],
        in_stock_only: bool,
    ) -> Optional[dict]:
        filters = []

        if category:
            filters.append({"category": {"$eq": category}})

        if max_price is not None:
            filters.append({"discount_price": {"$lte": max_price}})

        if in_stock_only:
            filters.append({"stock": {"$gt": 0}})

        if not filters:
            return None

        if len(filters) == 1:
            return filters[0]

        return {"$and": filters}

    def _flatten_query_result(self, result: dict) -> list[dict]:
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        rows = []
        for document, metadata, distance in zip(documents, metadatas, distances):
            rows.append(
                {
                    "document": document,
                    "metadata": metadata,
                    "distance": distance,
                }
            )
        return rows


chroma_service = ChromaService()

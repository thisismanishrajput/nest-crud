# Nest Ecom AI Service

This is a small Python microservice for ecommerce RAG.

For now it is independent from the NestJS backend. Later, NestJS will call this service when products are created, updated, deleted, or searched.

## What This Service Does

1. Receives product data from NestJS.
2. Converts product data into searchable text.
3. Creates embeddings using a local sentence-transformer model.
4. Stores vectors in ChromaDB.
5. Accepts user search queries.
6. Uses semantic search to find matching products.
7. Returns product ids and a simple answer.

## Setup

```bash
cd ai-service
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API will run at:

```txt
http://localhost:8000
```

Swagger docs:

```txt
http://localhost:8000/docs
```

## Main Endpoints

Health check:

```bash
curl http://localhost:8000/health
```

Index one product:

```bash
curl -X POST http://localhost:8000/index/product \
  -H "Content-Type: application/json" \
  -d '{
    "id": "mongo-product-id",
    "product_id": "P1001",
    "title": "iPhone 15",
    "description": "A phone with strong camera and performance",
    "category": "Mobiles",
    "price": 70000,
    "discount_price": 65000,
    "stock": 10,
    "rating": 4.5
  }'
```

Search products:

```bash
curl -X POST http://localhost:8000/rag/search-products \
  -H "Content-Type: application/json" \
  -d '{
    "query": "phone under 70000 with good camera",
    "max_price": 70000,
    "in_stock_only": true
  }'
```

Ask a simple RAG query:

```bash
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "suggest me a good camera phone",
    "limit": 3
  }'
```

## Relevance Threshold

ChromaDB always returns the nearest products, even when they are unrelated.

To avoid wrong recommendations, this service filters out weak matches with:

```txt
SEARCH_MAX_DISTANCE=1.25
```

Lower value means stricter matching. Higher value means more products will be returned.

## Current Design

MongoDB is still the main database for ecommerce data.

ChromaDB only stores vectors and search metadata.

```txt
NestJS product create/update
-> Python /index/product
-> embedding created
-> vector stored in ChromaDB

User search
-> NestJS /rag/query
-> Python /rag/query
-> Chroma semantic search
-> product ids returned
-> NestJS fetches latest product data from MongoDB
```

## Beginner Note

The first time you run this service, the embedding model may download. After that, it should load from your local cache.

The model cache is kept inside:

```txt
ai-service/model_cache
```

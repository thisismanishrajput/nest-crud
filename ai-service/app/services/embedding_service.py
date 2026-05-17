import os

from app.config import settings


def get_embedding_function():
    os.environ.setdefault("HF_HOME", settings.model_cache_path)
    os.environ.setdefault("TRANSFORMERS_CACHE", settings.model_cache_path)

    from chromadb.utils import embedding_functions

    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.embedding_model
    )

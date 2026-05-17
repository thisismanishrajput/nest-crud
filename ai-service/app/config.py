from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nest Ecom AI Service"
    chroma_path: str = "./chroma_data"
    model_cache_path: str = "./model_cache"
    product_collection: str = "products"
    embedding_model: str = "all-MiniLM-L6-v2"
    search_result_limit: int = 5
    search_max_distance: float = 1.25

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

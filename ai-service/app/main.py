from fastapi import FastAPI

from app.config import settings
from app.routers import index, rag

app = FastAPI(title=settings.app_name)

app.include_router(index.router)
app.include_router(rag.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}

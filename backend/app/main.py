# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
 
from app.db.mongodb import connect_db, close_db
from app.api.products import router as products_router, scrape_router
from app.api.compare import router as compare_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()
 
 
app = FastAPI(
    title="LipSense API",
    description="Backend ABSA untuk sistem komparasi produk bibir",
    version="1.0.0",
    lifespan=lifespan,
)
 
# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ── Routers ───────────────────────────────────────────────────
app.include_router(products_router)
app.include_router(scrape_router)
app.include_router(compare_router)
 
 
# ── Health check ──────────────────────────────────────────────
@app.get("/api/test")
async def health_check():
    return {"message": "API berjalan dengan baik ✅"}

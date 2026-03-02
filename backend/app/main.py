#test

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Lip Product ABSA API")

# Izinkan Frontend (React) mengakses Backend ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/test")
async def test_connection():
    return {"status": "connected", "message": "Backend FastAPI siap digunakan!"}
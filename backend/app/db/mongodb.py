from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client: AsyncIOMotorClient = None

def get_database():
    return client[settings.MONGODB_DB]

async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"✅ Terhubung ke MongoDB: {settings.MONGODB_URL}")

async def close_db():
    global client
    if client:
        client.close()
        print("Koneksi MongoDB ditutup")
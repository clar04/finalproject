from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_connection = Database()

async def connect_to_mongo():
    # Mengambil URI dari .env yang Anda tentukan
    mongodb_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB")
    
    db_connection.client = AsyncIOMotorClient(mongodb_uri)
    db_connection.db = db_connection.client[db_name]
    print(f"Berhasil terhubung ke database: {db_name}")

async def close_mongo_connection():
    if db_connection.client:
        db_connection.client.close()
        print("Koneksi MongoDB ditutup.")
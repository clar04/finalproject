# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI:      str = "mongodb://localhost:27017"
    MONGODB_DB:       str = "absa"
    MONGODB_HOST:     str = "localhost"
    MONGODB_PORT:     int = 27017
    MONGODB_USER:     str = ""
    MONGODB_PASSWORD: str = ""

    # App
    APP_ENV: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"   # silently ignore any env vars not listed above

settings = Settings()
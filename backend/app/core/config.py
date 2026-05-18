from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB:  str = "absa"

    # App
    APP_ENV: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
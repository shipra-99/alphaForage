from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    environment: str = "development"

    # Auth
    secret_key: str = "change-me-in-production-min-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h for dev convenience

    # Market data
    polygon_api_key: str = ""
    finnhub_api_key: str = ""

    # AI
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    default_model: str = "gpt-4o"
    fast_model: str = "gpt-4o-mini"

    # DB — SQLite by default, swap for Postgres when you need to scale
    database_url: str = "sqlite+aiosqlite:///./alphaforage.db"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

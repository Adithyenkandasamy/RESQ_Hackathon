"""Application configuration loaded from environment variables.

Uses Pydantic Settings to validate and parse configuration at startup.
Required secrets (e.g. DATABASE_URL in production) must be provided via
environment variables or a .env file — they are never hardcoded.
"""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    Values are read from environment variables and, during local
    development, from a ``.env`` file in the working directory.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # Extra env vars are silently ignored rather than raising.
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "Emergency Response Coordination System"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # "development" | "production"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ─────────────────────────────────────────────────
    # Empty string means "no database configured".
    DATABASE_URL: str = ""

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8081"

    # ── Cache ────────────────────────────────────────────────────
    CACHE_DEFAULT_TTL: int = 300  # seconds
    CACHE_MAX_ENTRIES: int = 1000

    # ── Authentication & Security ────────────────────────────────
    JWT_SECRET_KEY: str = "dev-insecure-jwt-secret-key-at-least-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Validators ───────────────────────────────────────────────

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = {"development", "production"}
        if v not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}, got '{v}'")
        return v

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        v = v.upper()
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}, got '{v}'")
        return v

    @field_validator("CACHE_DEFAULT_TTL")
    @classmethod
    def validate_cache_ttl(cls, v: int) -> int:
        if v < 1:
            raise ValueError("CACHE_DEFAULT_TTL must be >= 1")
        return v

    @field_validator("CACHE_MAX_ENTRIES")
    @classmethod
    def validate_cache_max_entries(cls, v: int) -> int:
        if v < 1:
            raise ValueError("CACHE_MAX_ENTRIES must be >= 1")
        return v

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret_key(cls, v: str) -> str:
        if len(v.strip()) < 16:
            raise ValueError("JWT_SECRET_KEY must be at least 16 characters long")
        return v

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def validate_access_token_expire_minutes(cls, v: int) -> int:
        if v < 1:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be >= 1")
        return v

    # ── Derived helpers ──────────────────────────────────────────

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a validated list of origins."""
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        for origin in origins:
            if origin == "*":
                continue
            if not origin.startswith(("http://", "https://")):
                raise ValueError(
                    f"Each CORS origin must start with http:// or https://, got '{origin}'"
                )
        return origins

    @property
    def database_is_configured(self) -> bool:
        return bool(self.DATABASE_URL)


def get_settings() -> Settings:
    """Create and return a validated Settings instance.

    Raises ``ValidationError`` if required configuration is invalid.
    """
    return Settings()

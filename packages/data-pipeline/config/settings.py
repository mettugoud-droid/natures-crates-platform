"""Configuration settings for the data pipeline."""

import os
from pydantic import BaseModel


class DatabaseConfig(BaseModel):
    host: str = os.getenv("DB_HOST", "localhost")
    port: int = int(os.getenv("DB_PORT", "5432"))
    name: str = os.getenv("DB_NAME", "natures_crates")
    user: str = os.getenv("DB_USER", "postgres")
    password: str = os.getenv("DB_PASSWORD", "")


class AIConfig(BaseModel):
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    default_model: str = os.getenv("AI_DEFAULT_MODEL", "claude-sonnet-4-20250514")


class PipelineConfig(BaseModel):
    batch_size: int = 50
    max_retries: int = 3
    timeout_seconds: int = 300
    confidence_threshold: float = 0.7


settings = {
    "database": DatabaseConfig(),
    "ai": AIConfig(),
    "pipeline": PipelineConfig(),
}

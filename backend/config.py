"""
Configuration management for Spec-Bot backend
Uses Pydantic settings to load and validate environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
import os
from pathlib import Path


class Settings(BaseSettings):
    """Application configuration loaded from environment variables"""
    
    # API Keys
    openai_api_key: Optional[str] = Field(None, env="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(None, env="ANTHROPIC_API_KEY")
    tavily_api_key: Optional[str] = Field(None, env="TAVILY_API_KEY")
    
    # Application Settings
    environment: str = Field("development", env="ENVIRONMENT")
    log_level: str = Field("info", env="LOG_LEVEL")
    cors_origins: str = Field(
        "http://localhost:3000,http://localhost:5173", 
        env="CORS_ORIGINS"
    )
    
    # File Storage
    output_dir: str = Field(".specbot/specs", env="OUTPUT_DIR")
    backup_dir: str = Field(".specbot/backups", env="BACKUP_DIR")
    
    # LLM Configuration
    default_llm_provider: str = Field("openai", env="DEFAULT_LLM_PROVIDER")
    default_model: str = Field("gpt-4.1", env="DEFAULT_MODEL")
    max_tokens: int = Field(4000, env="MAX_TOKENS")
    temperature: float = Field(0.7, env="TEMPERATURE")
    
    # Workflow Configuration
    approval_timeout: int = Field(3600, env="APPROVAL_TIMEOUT")  # 1 hour
    max_revision_attempts: int = Field(3, env="MAX_REVISION_ATTEMPTS")
    enable_research: bool = Field(True, env="ENABLE_RESEARCH")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS origins string to list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist"""
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.backup_dir).mkdir(parents=True, exist_ok=True)
    
    def validate_api_keys(self) -> dict:
        """Validate which API keys are available"""
        return {
            "openai": bool(self.openai_api_key),
            "anthropic": bool(self.anthropic_api_key),
            "tavily": bool(self.tavily_api_key and self.enable_research)
        }


# Global settings instance
settings = Settings()

# Ensure required directories exist
settings.ensure_directories() 
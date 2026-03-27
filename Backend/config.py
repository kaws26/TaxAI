from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).with_name(".env"))


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-jwt-secret-key")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///taxai.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_API_BASE_URL = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1/chat/completions")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GROQ_ENABLED = _env_bool("GROQ_ENABLED", True)
    GROQ_REASONING_EFFORT = os.getenv("GROQ_REASONING_EFFORT", "low")
    GROQ_MAX_COMPLETION_TOKENS = int(os.getenv("GROQ_MAX_COMPLETION_TOKENS", "600"))
    GROQ_BANK_ROWS_PER_CALL = int(os.getenv("GROQ_BANK_ROWS_PER_CALL", "20"))
    GROQ_OCR_MAX_INPUT_CHARS = int(os.getenv("GROQ_OCR_MAX_INPUT_CHARS", "12000"))
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")
    PDF_EXPORT_DIR = os.getenv("PDF_EXPORT_DIR", "generated_pdfs")

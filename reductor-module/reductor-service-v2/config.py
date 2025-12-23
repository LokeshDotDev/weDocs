"""
config.py

Configuration for Reductor Service v2
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # FastAPI
    APP_NAME = "Reductor Service v2"
    APP_VERSION = "2.0.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    PORT = int(os.getenv("REDUCTOR_PORT", 5018))

    # MinIO
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

    # Conversion
    TEMP_DIR = os.getenv("TEMP_DIR", "./tmp")


config = Config()

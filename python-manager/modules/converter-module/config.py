import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # FastAPI
    APP_NAME = "PDF to HTML Converter Module"
    APP_VERSION = "0.1.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    PORT = int(os.getenv("PORT", 5001))
    
    # MinIO
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET = os.getenv("MINIO_BUCKET", "uploads")
    MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    
    # Conversion
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
    CONVERSION_TIMEOUT = 300  # 5 minutes
    TEMP_DIR = os.getenv("TEMP_DIR", "./tmp")

config = Config()

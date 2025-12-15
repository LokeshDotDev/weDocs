import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # FastAPI
    APP_NAME = "Document Processing Manager"
    APP_VERSION = "0.1.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    PORT = int(os.getenv("PORT", 5000))
    
    # Service Registry - routes to different modules
    SERVICES = {
        "converter": {
            "url": os.getenv("CONVERTER_MODULE_URL", "http://localhost:5001"),
            "endpoints": {
                "pdf-to-html": "/convert/pdf-to-html",
                "pdf-to-html-direct": "/convert/pdf-to-html-direct",
                "health": "/health",
            }
        },
        # Future services:
        # "ai-detector": {
        #     "url": "http://localhost:5002",
        #     "endpoints": { "detect": "/detect", ... }
        # },
        # "humanizer": {
        #     "url": "http://localhost:5003",
        #     "endpoints": { "humanize": "/humanize", ... }
        # }
    }

config = Config()


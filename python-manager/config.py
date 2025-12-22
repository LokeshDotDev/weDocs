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
                "pdf-to-docx": "/convert/pdf-to-docx",
                "pdf-to-html": "/convert/pdf-to-html",
                "pdf-to-html-direct": "/convert/pdf-to-html-direct",
                "health": "/health",
            }
        },
        "reductor": {
            "url": os.getenv("REDUCTOR_MODULE_URL", "http://localhost:5017"),
            "endpoints": {
                "anonymize-text": "/anonymize/text",
                "anonymize-docx": "/anonymize/docx",
                "health": "/health",
            }
        },
        "ai-detector": {
            "url": os.getenv("AI_DETECTOR_MODULE_URL", "http://localhost:5002"),
            "endpoints": {
                "detect": "/detect",
                "batch-detect": "/batch-detect",
                "health": "/health",
            }
        },
        "humanizer": {
            "url": os.getenv("HUMANIZER_MODULE_URL", "http://localhost:8000"),
            "endpoints": {
                "humanize": "/humanize",
                "health": "/health",
            }
        }
    }

config = Config()


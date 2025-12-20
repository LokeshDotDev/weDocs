from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import requests
from config import config
from logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    debug=config.DEBUG,
)

# Models
class ConvertPdfToHtmlRequest(BaseModel):
    user_id: str
    upload_id: str
    filename: str
    relative_path: str

class HealthResponse(BaseModel):
    status: str
    version: str

# Routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Manager health check - also checks registered services."""
    service_health = {}
    for service_name, service_config in config.SERVICES.items():
        try:
            response = requests.get(
                f"{service_config['url']}/health",
                timeout=5
            )
            service_health[service_name] = "connected" if response.status_code == 200 else "error"
        except Exception as e:
            logger.warning(f"Service {service_name} unhealthy: {e}")
            service_health[service_name] = "disconnected"
    
    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "services": service_health,
    }

@app.post("/convert/pdf-to-html")
async def convert_pdf_to_html(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route PDF to HTML conversion to Converter Module.
    
    This is just a proxy - actual conversion is done by converter-module service.
    """
    try:
        logger.info(f"🔄 Routing conversion request to converter module: {request.filename}")
        
        # Get converter service config
        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")
        
        # Forward request to converter module
        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-html']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,  # 5 minutes
        )
        
        # Return converter response
        if response.status_code == 200:
            logger.info(f"✅ Conversion routed successfully")
            return response.json()
        else:
            logger.error(f"❌ Converter module returned error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Conversion failed")
            )
    
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to converter module")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Conversion routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route PDF to DOCX conversion to Converter Module (for ONLYOFFICE).
    """
    try:
        logger.info(f"Routing PDF->DOCX conversion request to converter module: {request.filename}")

        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")

        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-docx']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,
        )

        if response.status_code == 200:
            logger.info("PDF->DOCX conversion routed successfully")
            return response.json()
        else:
            logger.error(f"Converter module returned error (pdf-to-docx): {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "PDF->DOCX conversion failed"),
            )
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to converter module (pdf-to-docx)")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF->DOCX routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/pdf-to-html-direct")
async def convert_pdf_to_html_direct(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Route direct PDF→HTML conversion (PyMuPDF) to Converter Module.
    """
    try:
        logger.info(f"🔄 Routing DIRECT conversion request to converter module: {request.filename}")

        converter_service = config.SERVICES.get("converter")
        if not converter_service:
            raise HTTPException(status_code=500, detail="Converter service not registered")

        converter_url = f"{converter_service['url']}{converter_service['endpoints']['pdf-to-html-direct']}"
        response = requests.post(
            converter_url,
            json=request.dict(),
            timeout=300,
        )

        if response.status_code == 200:
            logger.info("✅ DIRECT conversion routed successfully")
            return response.json()
        else:
            logger.error(f"❌ Converter module returned error (direct): {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Direct conversion failed"),
            )
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to converter module (direct)")
        raise HTTPException(status_code=503, detail="Converter service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Direct conversion routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai-detection/detect")
async def ai_detect(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Route AI detection request to AI Detector Module.
    Expects: { "texts": ["text1", "text2", ...] }
    Returns: { "results": [{ "text", "score", "label" }] }
    """
    try:
        logger.info(f"🔍 Routing AI detection request")
        
        ai_detector_service = config.SERVICES.get("ai-detector")
        if not ai_detector_service:
            raise HTTPException(status_code=500, detail="AI Detector service not registered")
        
        detector_url = f"{ai_detector_service['url']}{ai_detector_service['endpoints']['detect']}"
        response = requests.post(
            detector_url,
            json=request,
            timeout=600,
        )
        
        if response.status_code == 200:
            logger.info(f"✅ AI detection completed")
            return response.json()
        else:
            logger.error(f"❌ AI Detector returned error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "AI detection failed")
            )
    
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to AI Detector module")
        raise HTTPException(status_code=503, detail="AI Detector service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ AI detection routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/humanizer/humanize")
async def humanize_text(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Route humanization request to Humanizer Module.
    Expects: { "text": "some text", "mode": "standard" }
    Returns: { "humanized_text": "...", "metrics": {...} }
    """
    try:
        logger.info(f"✍️ Routing humanization request")
        
        humanizer_service = config.SERVICES.get("humanizer")
        if not humanizer_service:
            raise HTTPException(status_code=500, detail="Humanizer service not registered")
        
        humanizer_url = f"{humanizer_service['url']}{humanizer_service['endpoints']['humanize']}"
        response = requests.post(
            humanizer_url,
            json=request,
            timeout=300,
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Humanization completed")
            return response.json()
        else:
            logger.error(f"❌ Humanizer returned error: {response.status_code}")
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Humanization failed")
            )
    
    except requests.exceptions.ConnectionError:
        logger.error("❌ Cannot connect to Humanizer module")
        raise HTTPException(status_code=503, detail="Humanizer service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Humanization routing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": config.APP_NAME,
        "version": config.APP_VERSION,
        "description": "Orchestrator/Router for document processing services",
        "registered_services": list(config.SERVICES.keys()),
        "endpoints": {
            "health": "/health",
            "convert/pdf-to-html": "/convert/pdf-to-html",
            "convert/pdf-to-html-direct": "/convert/pdf-to-html-direct",
            "ai-detection/detect": "/ai-detection/detect",
            "humanizer/humanize": "/humanizer/humanize",
        },
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.PORT)

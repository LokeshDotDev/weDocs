from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from services.pdf_converter import PDFConverter
from services.docx_converter import DOCXConverter
from services.pdf_to_html_converter import PDF2HTMLConverter
from utils.minio_handler import minio_handler
from config import config
from logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    debug=config.DEBUG,
)

# Models
class ConvertPdfToDocxRequest(BaseModel):
    user_id: str
    upload_id: str
    filename: str
    relative_path: str

# Legacy support (kept for backward compatibility)
class ConvertPdfToHtmlRequest(BaseModel):
    user_id: str
    upload_id: str
    filename: str
    relative_path: str

class HealthResponse(BaseModel):
    status: str
    version: str
    service: str

# Routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "service": "converter",
    }

@app.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(request: ConvertPdfToDocxRequest) -> Dict[str, Any]:
    """
    Convert PDF to DOCX for editing in ONLYOFFICE.
    
    Flow:
    1. Download PDF from MinIO /raw/
    2. Convert PDF → DOCX (pdf2docx)
    3. Upload DOCX to MinIO /formatted/ (ready for editing)
    
    Returns conversion status and file path.
    """
    try:
        logger.info(f"📥 Received PDF→DOCX conversion request: {request.filename}")
        
        # Validate file type
        if not request.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Build MinIO object keys
        raw_key = f"users/{request.user_id}/uploads/{request.upload_id}/raw/{request.relative_path}"
        docx_key = f"users/{request.user_id}/uploads/{request.upload_id}/formatted/{request.relative_path.replace('.pdf', '.docx')}"
        
        logger.info(f"🔄 Starting PDF→DOCX conversion for {request.relative_path}")
        
        # Step 1: Download PDF from MinIO
        logger.info(f"📥 Downloading PDF: {raw_key}")
        pdf_data = minio_handler.download_file(raw_key)
        logger.info(f"✅ PDF downloaded ({len(pdf_data.getvalue())} bytes)")
        
        # Step 2: Convert PDF to DOCX
        logger.info(f"📄 Converting PDF → DOCX")
        docx_data = PDFConverter.convert_pdf_to_docx(pdf_data)
        logger.info(f"✅ DOCX created ({len(docx_data.getvalue())} bytes)")
        
        # Step 3: Upload DOCX to MinIO formatted/ (ready for editing)
        logger.info(f"📤 Uploading DOCX: {docx_key}")
        minio_handler.upload_file(docx_key, docx_data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        logger.info(f"✅ DOCX uploaded to MinIO - ready for editing in ONLYOFFICE")
        
        logger.info(f"✅ Conversion complete for {request.relative_path}")
        
        return {
            "status": "success",
            "user_id": request.user_id,
            "upload_id": request.upload_id,
            "filename": request.filename,
            "raw_path": raw_key,
            "formatted_path": docx_key,
            "conversion_type": "pdf_to_docx",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/pdf-to-html")
async def convert_pdf_to_html(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Convert PDF to HTML.
    
    Flow:
    1. Download PDF from MinIO /raw/
    2. Convert PDF → DOCX (pdf2docx)
    3. Upload DOCX to MinIO /converted/
    4. Convert DOCX → HTML (pandoc)
    5. Upload HTML to MinIO /formatted/
    
    Returns conversion status and file paths.
    """
    try:
        logger.info(f"📥 Received conversion request: {request.filename}")
        
        # Validate file type
        if not request.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Build MinIO object keys
        raw_key = f"users/{request.user_id}/uploads/{request.upload_id}/raw/{request.relative_path}"
        docx_key = f"users/{request.user_id}/uploads/{request.upload_id}/converted/{request.relative_path.replace('.pdf', '.docx')}"
        html_key = f"users/{request.user_id}/uploads/{request.upload_id}/formatted/{request.relative_path.replace('.pdf', '.html')}"
        
        logger.info(f"🔄 Starting conversion pipeline for {request.relative_path}")
        
        # Step 1: Download PDF from MinIO
        logger.info(f"📥 Downloading PDF: {raw_key}")
        pdf_data = minio_handler.download_file(raw_key)
        logger.info(f"✅ PDF downloaded ({len(pdf_data.getvalue())} bytes)")
        
        # Step 2: Convert PDF to DOCX
        logger.info(f"📄 Converting PDF → DOCX")
        docx_data = PDFConverter.convert_pdf_to_docx(pdf_data)
        logger.info(f"✅ DOCX created ({len(docx_data.getvalue())} bytes)")
        
        # Step 3: Upload DOCX to MinIO converted/
        logger.info(f"📤 Uploading DOCX: {docx_key}")
        minio_handler.upload_file(docx_key, docx_data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        logger.info(f"✅ DOCX uploaded to MinIO")
        
        # Step 4: Convert DOCX to HTML (using mammoth for better style preservation)
        logger.info(f"🌐 Converting DOCX → HTML")
        html_data = DOCXConverter.convert_docx_to_html_mammoth(docx_data)
        logger.info(f"✅ HTML created ({len(html_data.getvalue())} bytes)")
        
        # Step 5: Upload HTML to MinIO formatted/
        logger.info(f"📤 Uploading HTML: {html_key}")
        minio_handler.upload_file(html_key, html_data, "text/html")
        logger.info(f"✅ HTML uploaded to MinIO")
        
        logger.info(f"✅ Conversion pipeline complete for {request.relative_path}")
        
        return {
            "status": "success",
            "user_id": request.user_id,
            "upload_id": request.upload_id,
            "filename": request.filename,
            "raw_path": raw_key,
            "converted_path": docx_key,
            "formatted_path": html_key,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/pdf-to-html-direct")
async def convert_pdf_to_html_direct(request: ConvertPdfToHtmlRequest) -> Dict[str, Any]:
    """
    Convert PDF directly to HTML using pdf2htmlEX (pixel-perfect).
    
    Flow:
    1. Download PDF from MinIO /raw/
    2. Convert PDF → HTML (pdf2htmlEX) - PIXEL PERFECT
    3. Upload HTML to MinIO /formatted/
    
    This skips DOCX step for better quality.
    """
    try:
        logger.info(f"📥 Received DIRECT conversion request: {request.filename}")
        
        # Validate file type
        if not request.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Build MinIO object keys
        raw_key = f"users/{request.user_id}/uploads/{request.upload_id}/raw/{request.relative_path}"
        html_key = f"users/{request.user_id}/uploads/{request.upload_id}/formatted/{request.relative_path.replace('.pdf', '.html')}"
        
        logger.info(f"🔄 Starting DIRECT PDF→HTML conversion for {request.relative_path}")
        
        # Step 1: Download PDF from MinIO
        logger.info(f"📥 Downloading PDF: {raw_key}")
        pdf_data = minio_handler.download_file(raw_key)
        logger.info(f"✅ PDF downloaded ({len(pdf_data.getvalue())} bytes)")
        
        # Step 2: Convert PDF directly to HTML (pixel-perfect)
        logger.info(f"🎨 Converting PDF → HTML (pixel-perfect)")
        html_data = PDF2HTMLConverter.convert_pdf_to_html_direct(pdf_data)
        logger.info(f"✅ HTML created ({len(html_data.getvalue())} bytes)")
        
        # Step 3: Upload HTML to MinIO formatted/
        logger.info(f"📤 Uploading HTML: {html_key}")
        minio_handler.upload_file(html_key, html_data, "text/html")
        logger.info(f"✅ HTML uploaded to MinIO")
        
        logger.info(f"✅ DIRECT conversion complete for {request.relative_path}")
        
        return {
            "status": "success",
            "user_id": request.user_id,
            "upload_id": request.upload_id,
            "filename": request.filename,
            "raw_path": raw_key,
            "formatted_path": html_key,
            "conversion_type": "direct_pdf2htmlex",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Direct conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": config.APP_NAME,
        "version": config.APP_VERSION,
        "endpoints": {
            "health": "/health",
            "convert": "/convert/pdf-to-docx",
            "convert_legacy_html": "/convert/pdf-to-html",
            "convert_direct_html": "/convert/pdf-to-html-direct",
        },
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.PORT)

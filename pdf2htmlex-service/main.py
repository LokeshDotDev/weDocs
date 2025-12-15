"""
FastAPI wrapper for pdf2htmlEX.
Exposes HTTP endpoint to convert PDF to HTML.
"""

import io
import os
import subprocess
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="pdf2htmlEX Service", version="1.0.0")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Verify pdf2htmlEX is available
        result = subprocess.run(
            ["pdf2htmlEX", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        if result.returncode == 0:
            return {
                "status": "ok",
                "service": "pdf2htmlEX",
                "version": result.stdout.decode(errors="ignore").strip()
            }
        else:
            return {"status": "error", "message": "pdf2htmlEX not available"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/convert")
async def convert_pdf_to_html(file: UploadFile = File(...)):
    """
    Convert uploaded PDF to HTML using pdf2htmlEX.
    
    Returns:
        - HTML file (Content-Type: text/html)
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        logger.info(f"Converting PDF: {file.filename}")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write PDF to temp file
            pdf_path = os.path.join(tmpdir, "input.pdf")
            html_path = os.path.join(tmpdir, "output.html")
            
            pdf_content = await file.read()
            with open(pdf_path, "wb") as f:
                f.write(pdf_content)
            
            logger.info(f"PDF written: {len(pdf_content)} bytes")
            
            # Run pdf2htmlEX with embedding for pixel-perfect output
            cmd = [
                "pdf2htmlEX",
                "--embed", "cfijo",  # Embed CSS, fonts, images, JS, outline
                "--optimize-text", "1",
                "--zoom", "1.3",
                "-o", html_path,
                pdf_path,
            ]
            
            logger.info(f"Running: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=120
            )
            
            if result.returncode != 0:
                error = result.stderr.decode(errors="ignore")
                logger.error(f"pdf2htmlEX failed: {error}")
                raise HTTPException(status_code=500, detail=f"Conversion failed: {error}")
            
            logger.info(f"Conversion successful: {html_path}")
            
            # Read resulting HTML
            if not os.path.exists(html_path):
                raise HTTPException(status_code=500, detail="HTML file not generated")
            
            with open(html_path, "rb") as f:
                html_bytes = f.read()
            
            logger.info(f"HTML generated: {len(html_bytes)} bytes")
            
            return FileResponse(
                path=html_path,
                filename=file.filename.replace(".pdf", ".html"),
                media_type="text/html"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "pdf2htmlEX HTTP Wrapper",
        "version": "1.0.0",
        "description": "Convert PDF to pixel-perfect HTML",
        "endpoints": {
            "health": "/health",
            "convert": "/convert (POST)",
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)

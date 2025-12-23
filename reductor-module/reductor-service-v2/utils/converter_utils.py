"""
converter_utils.py

PDF to DOCX conversion - delegates to working converter module
"""

import io
import sys
import os
from logger import get_logger

logger = get_logger(__name__)


def pdf_to_docx(pdf_data: io.BytesIO) -> io.BytesIO:
    """
    Convert PDF to DOCX preserving structure.
    
    Uses the stable converter from converter-module.
    
    Args:
        pdf_data: BytesIO containing PDF bytes
    
    Returns:
        BytesIO containing DOCX bytes
    """
    logger.info("📄 Converting PDF → DOCX (using converter-module)...")
    
    try:
        # Import converter from converter-module
        ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        converter_path = os.path.join(ROOT, "python-manager", "modules", "converter-module")
        if converter_path not in sys.path:
            sys.path.insert(0, converter_path)
        
        from services.pdf_converter import PDFConverter
        
        # Use the working converter
        docx_data = PDFConverter.convert_pdf_to_docx(pdf_data)
        
        logger.info(f"✅ PDF → DOCX complete ({len(docx_data.getvalue())} bytes)")
        return docx_data
        
    except Exception as e:
        logger.error(f"❌ PDF conversion failed: {e}")
        raise

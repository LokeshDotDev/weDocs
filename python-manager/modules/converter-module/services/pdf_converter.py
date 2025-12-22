import io
import os
import tempfile

# pdf2docx uses PyMuPDF's deprecated Page.getText; alias to new get_text to keep compatibility.
import fitz  # PyMuPDF
from pdf2docx.converter import Converter
from config import config
from logger import get_logger

# Compatibility shim: map deprecated PyMuPDF APIs used by pdf2docx
if not hasattr(fitz.Page, "getText") and hasattr(fitz.Page, "get_text"):
    setattr(fitz.Page, "getText", fitz.Page.get_text)
if not hasattr(fitz.Page, "getImageList") and hasattr(fitz.Page, "get_images"):
    setattr(fitz.Page, "getImageList", fitz.Page.get_images)
if not hasattr(fitz.Page, "getLinks") and hasattr(fitz.Page, "get_links"):
    setattr(fitz.Page, "getLinks", fitz.Page.get_links)
if not hasattr(fitz.Page, "getPixmap") and hasattr(fitz.Page, "get_pixmap"):
    setattr(fitz.Page, "getPixmap", fitz.Page.get_pixmap)
if not hasattr(fitz.Page, "getPNGData") and hasattr(fitz.Page, "get_png_data"):
    setattr(fitz.Page, "getPNGData", fitz.Page.get_png_data)
if not hasattr(fitz.Page, "getDrawings") and hasattr(fitz.Page, "get_drawings"):
    setattr(fitz.Page, "getDrawings", fitz.Page.get_drawings)
if not hasattr(fitz.Page, "rotationMatrix") and hasattr(fitz.Page, "rotation_matrix"):
    setattr(fitz.Page, "rotationMatrix", property(lambda self: self.rotation_matrix))

# Rect compatibility for area
if not hasattr(fitz.Rect, "getArea"):
    if hasattr(fitz.Rect, "get_area"):
        setattr(fitz.Rect, "getArea", fitz.Rect.get_area)
    elif hasattr(fitz.Rect, "area"):
        setattr(fitz.Rect, "getArea", lambda self: self.area)

logger = get_logger(__name__)

class PDFConverter:
    @staticmethod
    def convert_pdf_to_docx(pdf_data: io.BytesIO) -> io.BytesIO:
        """Convert PDF to DOCX format."""
        try:
            logger.info("Starting PDF to DOCX conversion")
            
            # Create temporary files
            temp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            temp_docx = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
            
            try:
                # Write PDF data to temp file
                pdf_data.seek(0)
                temp_pdf.write(pdf_data.read())
                temp_pdf.close()
                
                # Convert PDF to DOCX
                converter = Converter(temp_pdf.name)
                converter.convert(temp_docx.name)
                converter.close()
                
                # Read converted DOCX
                temp_docx.close()
                with open(temp_docx.name, "rb") as f:
                    docx_data = io.BytesIO(f.read())
                
                logger.info("✅ PDF to DOCX conversion successful")
                return docx_data
                
            finally:
                # Cleanup temp files
                if os.path.exists(temp_pdf.name):
                    os.unlink(temp_pdf.name)
                if os.path.exists(temp_docx.name):
                    os.unlink(temp_docx.name)
                    
        except Exception as e:
            logger.error(f"❌ PDF to DOCX conversion failed: {e}")
            raise

import io
import os
from pdf2docx.converter import Converter
from config import config
from logger import get_logger
import tempfile

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

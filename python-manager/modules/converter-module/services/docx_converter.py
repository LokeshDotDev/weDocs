import io
import os
import subprocess
import tempfile
import shutil
import platform
from config import config
from logger import get_logger

logger = get_logger(__name__)

class DOCXConverter:
    @staticmethod
    def _find_pandoc():
        """Find pandoc executable in system PATH or common install locations."""
        # First try shutil.which (works if pandoc is in PATH)
        pandoc = shutil.which("pandoc")
        if pandoc:
            return pandoc
        
        # Try common Windows install locations
        windows_paths = [
            os.path.expanduser("~\\AppData\\Local\\Pandoc\\pandoc.exe"),
            "C:\\Program Files\\Pandoc\\pandoc.exe",
            "C:\\Program Files (x86)\\Pandoc\\pandoc.exe",
            os.path.expanduser("~\\AppData\\Roaming\\Python\\Scripts\\pandoc.exe"),
        ]
        
        for path in windows_paths:
            if os.path.exists(path):
                logger.info(f"Found pandoc at: {path}")
                return path
        
        return None
    
    @staticmethod
    def convert_docx_to_html_mammoth(docx_data: io.BytesIO) -> io.BytesIO:
        """Convert DOCX to HTML using mammoth (better style preservation)."""
        try:
            import mammoth
            
            logger.info("Starting DOCX to HTML conversion with mammoth")
            docx_data.seek(0)
            
            # Convert with mammoth - preserves styling better
            result = mammoth.convert_to_html(docx_data)
            html_content = result.value
            
            # Wrap in complete HTML document with CSS for better rendering
            full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted Document</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
        }}
        h1, h2, h3, h4, h5, h6 {{
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }}
        p {{
            margin-bottom: 1em;
        }}
        strong {{
            font-weight: 600;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>"""
            
            logger.info("✅ DOCX to HTML conversion successful with mammoth")
            return io.BytesIO(full_html.encode('utf-8'))
            
        except ImportError:
            logger.warn("mammoth not available, falling back to pandoc")
            return DOCXConverter.convert_docx_to_html(docx_data)
        except Exception as e:
            logger.error(f"❌ mammoth conversion failed: {e}, falling back to pandoc")
            return DOCXConverter.convert_docx_to_html(docx_data)
    
    @staticmethod
    def convert_docx_to_html(docx_data: io.BytesIO) -> io.BytesIO:
        """Convert DOCX to HTML using pandoc."""
        try:
            logger.info("Starting DOCX to HTML conversion")
            
            # Find pandoc
            pandoc_cmd = DOCXConverter._find_pandoc()
            if not pandoc_cmd:
                raise RuntimeError("pandoc not found. Install with: choco install pandoc -y")
            
            logger.info(f"Using pandoc at: {pandoc_cmd}")
            
            # Create temporary files with explicit paths (avoid locking issues on Windows)
            temp_dir = tempfile.gettempdir()
            temp_docx_path = os.path.join(temp_dir, f"temp_docx_{os.urandom(8).hex()}.docx")
            temp_html_path = os.path.join(temp_dir, f"temp_html_{os.urandom(8).hex()}.html")
            
            try:
                # Write DOCX data to temp file
                with open(temp_docx_path, "wb") as f:
                    docx_data.seek(0)
                    f.write(docx_data.read())
                
                # Convert DOCX to HTML using pandoc with style preservation
                subprocess.run(
                    [
                        pandoc_cmd,
                        temp_docx_path,
                        "-f", "docx",
                        "-t", "html",
                        "-o", temp_html_path,
                        "--standalone",           # Generate complete HTML document
                        "--self-contained",       # Embed all resources
                        "--wrap=none",           # Don't wrap lines
                        "--embed-resources",     # Embed images and styles
                        "--metadata", "title=Converted Document",
                    ],
                    check=True,
                    timeout=config.CONVERSION_TIMEOUT,
                )
                
                # Read converted HTML (ensure file is not locked)
                import time
                time.sleep(0.1)  # Brief pause to ensure file is released on Windows
                with open(temp_html_path, "rb") as f:
                    html_data = io.BytesIO(f.read())
                
                logger.info("✅ DOCX to HTML conversion successful")
                return html_data
                
            finally:
                # Cleanup temp files
                for path in [temp_docx_path, temp_html_path]:
                    try:
                        if os.path.exists(path):
                            os.unlink(path)
                    except OSError as e:
                        logger.warn(f"Failed to cleanup {path}: {e}")
                    
        except Exception as e:
            logger.error(f"❌ DOCX to HTML conversion failed: {e}")
            raise

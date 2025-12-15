import io
import base64
from logger import get_logger

logger = get_logger(__name__)

class PDF2HTMLConverter:
    @staticmethod
    def convert_pdf_to_html_direct(pdf_data: io.BytesIO) -> io.BytesIO:
        """
        Convert PDF to pixel-perfect HTML using PDF.js.
        Embeds the PDF as base64 and renders it client-side with PDF.js.
        This provides 100% accurate rendering matching the original PDF.
        """
        try:
            logger.info("Starting PDF to HTML conversion with PDF.js")

            # Encode PDF as base64
            pdf_data.seek(0)
            pdf_base64 = base64.b64encode(pdf_data.read()).decode('utf-8')
            
            html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Document</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #525659;
            overflow-x: hidden;
        }}
        #pdf-container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        .pdf-page {{
            margin: 20px auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            background: white;
            display: block;
        }}
        #loading {{
            text-align: center;
            color: white;
            padding: 50px;
            font-size: 18px;
        }}
        .controls {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
        }}
        .controls button {{
            margin: 0 5px;
            padding: 8px 15px;
            cursor: pointer;
            border: none;
            background: #0066cc;
            color: white;
            border-radius: 3px;
            font-size: 14px;
        }}
        .controls button:hover {{ background: #0052a3; }}
        .page-info {{
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="zoomIn()">Zoom In</button>
        <button onclick="zoomOut()">Zoom Out</button>
        <button onclick="resetZoom()">Reset</button>
    </div>
    <div id="loading">Loading PDF...</div>
    <div id="pdf-container"></div>
    <div class="page-info" id="page-info"></div>

    <script>
        const pdfData = atob('{pdf_base64}');
        const pdfArray = new Uint8Array(pdfData.length);
        for (let i = 0; i < pdfData.length; i++) {{
            pdfArray[i] = pdfData.charCodeAt(i);
        }}

        let pdfDoc = null;
        let scale = 1.5;
        const minScale = 0.5;
        const maxScale = 3.0;

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        function zoomIn() {{ scale = Math.min(scale + 0.2, maxScale); renderAllPages(); }}
        function zoomOut() {{ scale = Math.max(scale - 0.2, minScale); renderAllPages(); }}
        function resetZoom() {{ scale = 1.5; renderAllPages(); }}

        async function renderAllPages() {{
            const container = document.getElementById('pdf-container');
            container.innerHTML = '';
            
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {{
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({{ scale: scale }});
                
                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page';
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                container.appendChild(canvas);

                const context = canvas.getContext('2d');
                await page.render({{
                    canvasContext: context,
                    viewport: viewport
                }}).promise;
            }}
            
            document.getElementById('page-info').textContent = 
                `${{pdfDoc.numPages}} pages • Zoom: ${{Math.round(scale * 100)}}%`;
        }}

        pdfjsLib.getDocument({{ data: pdfArray }}).promise.then(async function(pdf) {{
            pdfDoc = pdf;
            document.getElementById('loading').style.display = 'none';
            await renderAllPages();
        }}).catch(function(error) {{
            document.getElementById('loading').textContent = 'Error loading PDF: ' + error.message;
        }});
    </script>
</body>
</html>'''

            logger.info(f"✅ PDF.js HTML created ({len(html_content)} bytes)")
            return io.BytesIO(html_content.encode('utf-8'))

        except Exception as e:
            logger.error(f"❌ PDF to HTML conversion failed: {e}")
            raise

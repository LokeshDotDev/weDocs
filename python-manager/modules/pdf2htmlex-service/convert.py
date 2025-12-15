#!/usr/bin/env python3
import subprocess
import sys
import os

def convert_pdf_to_html(pdf_path, html_path):
    """Convert PDF to HTML using pdf2htmlEX with optimal settings."""
    try:
        # Run pdf2htmlEX with settings for best quality
        subprocess.run([
            'pdf2htmlEX',
            '--zoom', '1.3',                    # Better resolution
            '--embed', 'cfijo',                 # Embed fonts, images, CSS, JS, outline
            '--dest-dir', os.path.dirname(html_path),
            '--page-filename', '',              # Single file output
            pdf_path,
            os.path.basename(html_path)
        ], check=True, capture_output=True, text=True)
        
        print(f"✅ Conversion successful: {html_path}")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Conversion failed: {e.stderr}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: convert.py <input.pdf> <output.html>", file=sys.stderr)
        sys.exit(1)
    
    sys.exit(convert_pdf_to_html(sys.argv[1], sys.argv[2]))

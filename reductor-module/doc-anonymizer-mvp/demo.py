"""
demo.py

Quick demo runner.
Processes one DOCX file and outputs anonymized version.
"""

from backend.batch.processor import process_docx

if __name__ == "__main__":
    process_docx(
        input_docx="examples/input/sample.docx",
        output_docx="examples/output/sample_cleaned.docx"
    )

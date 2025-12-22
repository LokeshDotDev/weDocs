#!/usr/bin/env python3
"""
Quick test to verify anonymization worked.
Extracts text from original vs anonymized DOCX and compares.
"""
import sys
import os
from zipfile import ZipFile
from lxml import etree

def extract_text_from_docx(docx_path: str) -> str:
    """Extract all visible text from a DOCX file."""
    try:
        with ZipFile(docx_path, 'r') as zip_ref:
            xml_content = zip_ref.read('word/document.xml')
            root = etree.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            texts = root.xpath("//w:t", namespaces=ns)
            return " ".join(t.text for t in texts if t.text)
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 test_anonymization.py <original.docx> <anonymized.docx>")
        sys.exit(1)

    orig_path = sys.argv[1]
    anon_path = sys.argv[2]

    if not os.path.exists(orig_path):
        print(f"Original file not found: {orig_path}")
        sys.exit(1)

    if not os.path.exists(anon_path):
        print(f"Anonymized file not found: {anon_path}")
        sys.exit(1)

    orig_text = extract_text_from_docx(orig_path)
    anon_text = extract_text_from_docx(anon_path)

    print("=" * 80)
    print("ORIGINAL TEXT (first 500 chars):")
    print(orig_text[:500])
    print("\n" + "=" * 80)
    print("ANONYMIZED TEXT (first 500 chars):")
    print(anon_text[:500])
    print("\n" + "=" * 80)
    print(f"Original length: {len(orig_text)} chars")
    print(f"Anonymized length: {len(anon_text)} chars")
    print(f"Difference: {len(orig_text) - len(anon_text)} chars removed")
    print("=" * 80)

#!/usr/bin/env python3
"""
Verify that anonymization worked - extract text from original and anonymized DOCX.
"""
import sys
import os
from zipfile import ZipFile
from lxml import etree

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

def extract_docx_text(docx_path: str) -> str:
    """Extract all text from DOCX document.xml."""
    try:
        with ZipFile(docx_path, 'r') as zip_ref:
            xml_content = zip_ref.read('word/document.xml')
            root = etree.fromstring(xml_content)
            texts = root.xpath("//w:t", namespaces=WORD_NS)
            return "\n".join(t.text for t in texts if t.text)
    except Exception as e:
        return f"[Error: {e}]"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 verify_anonymization.py <anonymized.docx> [original.docx]")
        sys.exit(1)

    anon_path = sys.argv[1]
    
    if not os.path.exists(anon_path):
        print(f"❌ File not found: {anon_path}")
        sys.exit(1)

    anon_text = extract_docx_text(anon_path)
    
    print("=" * 80)
    print("📄 ANONYMIZED DOCUMENT TEXT (full)")
    print("=" * 80)
    print(anon_text)
    print("=" * 80)
    
    # Check what was removed
    if len(sys.argv) >= 3:
        orig_path = sys.argv[2]
        if os.path.exists(orig_path):
            orig_text = extract_docx_text(orig_path)
            print("\n📋 ORIGINAL DOCUMENT TEXT (first 800 chars)")
            print("=" * 80)
            print(orig_text[:800])
            print("=" * 80)
            
            # Detect removals
            removed_lines = []
            for line in orig_text.split('\n'):
                if line.strip() and line.strip() not in anon_text:
                    removed_lines.append(line.strip())
            
            if removed_lines:
                print(f"\n✂️ REMOVED CONTENT ({len(removed_lines)} lines):")
                for line in removed_lines[:10]:  # Show first 10
                    print(f"  - {line[:100]}")

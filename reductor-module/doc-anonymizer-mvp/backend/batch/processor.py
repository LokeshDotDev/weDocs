"""
processor.py

Coordinates the full pipeline:
- unzip DOCX
- load XML
- detect identity
- remove identity by clearing ONLY exact matching text nodes
- save XML with ZERO reformatting
- rezip DOCX
"""

import os
from backend.utils.docx_utils import (
    unzip_docx,
    load_xml,
    save_xml,
    zip_docx,
    cleanup_temp_dir
)
from backend.identity.detector import detect_identity
from backend.identity.confidence import assess_confidence
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
# Formatting disabled for now
# from backend.formatter.formatter import apply_formatting, enforce_run_fonts
# from backend.formatter.enforce_paragraph_formatting import enforce_paragraph_formatting


def process_docx(input_docx: str, output_docx: str):
    """
    Anonymize DOCX using BINARY string replacement.
    Works at byte level - preserves EVERY character including whitespace.
    """
    temp_dir = unzip_docx(input_docx)

    try:
        document_xml_path = os.path.join(temp_dir, "word/document.xml")
        
        # Phase 1: Parse ONLY to detect (read-only)
        document_tree = load_xml(document_xml_path)
        identity = detect_identity(document_tree)
        print(f"🔍 Detected: name={identity.get('name')}, roll={identity.get('roll_no')}")
        
        # Phase 2: Assess confidence
        confidence = assess_confidence(identity)
        print(f"✅ Confidence: remove_name={confidence['remove_name']}, remove_roll={confidence['remove_roll_no']}")

        # Phase 3: Read XML as BINARY (preserves every byte)
        with open(document_xml_path, 'rb') as f:
            xml_bytes = f.read()
        
        original_bytes = xml_bytes
        
        # Phase 4: Do byte-level replacement
        if confidence["remove_roll_no"] and identity.get("roll_no"):
            roll_no = identity["roll_no"].strip()
            # Convert to bytes for replacement
            roll_bytes = roll_no.encode('utf-8')
            # Find and replace within <w:t> tags
            import re
            pattern = b'(<w:t[^>]*>)' + re.escape(roll_bytes) + b'(</w:t>)'
            replacement = b'\\1\\2'  # Keep tags, remove text
            xml_bytes = re.sub(pattern, replacement, xml_bytes)
            print(f"✂️ Removed roll: '{roll_no}'")

        if confidence["remove_name"] and identity.get("name"):
            name = identity["name"].strip()
            name_bytes = name.encode('utf-8')
            # Case-insensitive: try exact case first, then variations
            pattern = b'(<w:t[^>]*>)' + re.escape(name_bytes) + b'(</w:t>)'
            replacement = b'\\1\\2'
            xml_bytes = re.sub(pattern, replacement, xml_bytes, flags=re.IGNORECASE)
            print(f"✂️ Removed name: '{name}'")

        # Phase 5: Write back as BINARY (preserves every byte)
        if xml_bytes != original_bytes:
            with open(document_xml_path, 'wb') as f:
                f.write(xml_bytes)
            print(f"💾 Binary replacement done (100% alignment preserved)")
        
        # Phase 6: Rezip
        zip_docx(temp_dir, output_docx)
        print(f"✅ Complete: {output_docx}")

    finally:
        cleanup_temp_dir(temp_dir)

"""
processor.py

New ultra-conservative pipeline:
- unzip DOCX
- parse XML ONLY for detection (read-only)
- remove name/roll with byte-level replacements in document.xml
- never re-serialize XML (avoids any formatting/alignment change)
- rezip DOCX
"""

import os
import re

from backend.utils.docx_utils import unzip_docx, load_xml, zip_docx, cleanup_temp_dir
from backend.identity.detector import detect_identity
from backend.identity.confidence import assess_confidence


def _remove_value_bytes(xml_bytes: bytes, value: str) -> bytes:
    """
    Remove value from XML bytes while preserving all formatting.
    Tries to clear the text inside <w:t>...</w:t> without touching tags.
    Falls back to raw byte replacement if no tag-wrapped match is found.
    """
    if not value or not value.strip():
        return xml_bytes

    val = value.strip().encode("utf-8")

    # Pattern: <w:t ...>VALUE</w:t>
    pattern = b"(<w:t[^>]*>)" + re.escape(val) + b"(</w:t>)"
    replaced = re.sub(pattern, b"\\1\\2", xml_bytes, flags=re.IGNORECASE)

    if replaced != xml_bytes:
        return replaced

    # Fallback: raw byte replace (last resort, still preserves formatting)
    return xml_bytes.replace(val, b"")


def process_docx(input_docx: str, output_docx: str):
    temp_dir = unzip_docx(input_docx)

    try:
        document_xml_path = os.path.join(temp_dir, "word/document.xml")

        # Phase 1: detect identity (read-only parse)
        document_tree = load_xml(document_xml_path)
        identity = detect_identity(document_tree)
        confidence = assess_confidence(identity)

        # Phase 2: read XML as bytes (preserve every byte)
        with open(document_xml_path, "rb") as f:
            xml_bytes = f.read()

        # Phase 3: remove roll number
        if confidence.get("remove_roll_no") and identity.get("roll_no"):
            xml_bytes = _remove_value_bytes(xml_bytes, identity["roll_no"])

        # Phase 4: remove name
        if confidence.get("remove_name") and identity.get("name"):
            xml_bytes = _remove_value_bytes(xml_bytes, identity["name"])

        # Phase 5: write bytes back
        with open(document_xml_path, "wb") as f:
            f.write(xml_bytes)

        # Phase 6: rezip DOCX
        zip_docx(temp_dir, output_docx)

    finally:
        cleanup_temp_dir(temp_dir)

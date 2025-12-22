"""
processor.py

Coordinates the full pipeline:
- unzip DOCX
- load XML
- detect identity
- remove identity
- save XML
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
from backend.cleaner.name_remover import remove_student_name
from backend.cleaner.rollno_remover import remove_roll_number


def process_docx(input_docx: str, output_docx: str):
    """
    Full pipeline for DOCX anonymization.
    
    Steps:
    1. Unzip DOCX to temporary directory
    2. Load document.xml with lxml
    3. Detect student identity (labels + fallback heuristics)
    4. Assess confidence (decide if safe to remove)
    5. Remove roll number (always, if detected)
    6. Remove name (only if HIGH/MEDIUM confidence)
    7. Save modified XML
    8. Rezip DOCX
    9. Cleanup temp files
    """
    temp_dir = unzip_docx(input_docx)

    try:
        document_xml_path = os.path.join(temp_dir, "word/document.xml")
        document_tree = load_xml(document_xml_path)

        # Phase 1: Detect identity
        identity = detect_identity(document_tree)
        print(f"🔍 Detected: name={identity.get('name')}, roll={identity.get('roll_no')}, confidence={identity.get('confidence')}")
        
        # Phase 2: Assess confidence
        confidence = assess_confidence(identity)
        print(f"✅ Confidence decision: remove_name={confidence['remove_name']}, remove_roll={confidence['remove_roll_no']}")

        # Phase 3: Remove identity
        if confidence["remove_roll_no"] and identity.get("roll_no"):
            remove_roll_number(document_tree, identity["roll_no"])
            print(f"✂️ Removed roll number: {identity['roll_no']}")

        if confidence["remove_name"] and identity.get("name"):
            remove_student_name(document_tree, identity["name"])
            print(f"✂️ Removed student name: {identity['name']}")

        # Phase 4: Save XML and rezip
        save_xml(document_tree, document_xml_path)
        zip_docx(temp_dir, output_docx)
        print(f"✅ Anonymized DOCX saved: {output_docx}")

    finally:
        cleanup_temp_dir(temp_dir)

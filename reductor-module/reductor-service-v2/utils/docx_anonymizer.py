"""
docx_anonymizer.py

DOCX anonymization via text-node-level removal.

CRITICAL PRINCIPLE:
- NEVER re-serialize XML (breaks formatting)
- ONLY clear text node content
- Remove by exact text match in <w:t>VALUE</w:t>
- Fallback: byte-level replacement on document.xml
- Preserves all structure, spacing, alignment
"""

import os
import re
import zipfile
import tempfile
from lxml import etree
from logger import get_logger

logger = get_logger(__name__)

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def unzip_docx(docx_path: str) -> str:
    """Unzip DOCX to temp directory."""
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(docx_path, 'r') as z:
        z.extractall(temp_dir)
    return temp_dir


def load_xml(xml_path: str) -> etree._ElementTree:
    """Load XML with parser that preserves all whitespace."""
    parser = etree.XMLParser(
        remove_blank_text=False,
        strip_cdata=False,
        remove_comments=False,
    )
    return etree.parse(xml_path, parser)


def zip_docx(temp_dir: str, output_path: str):
    """Rezip DOCX from temp directory."""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for foldername, _, filenames in os.walk(temp_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, temp_dir)
                z.write(file_path, arcname)


def _remove_value_from_text_nodes(docx_path: str, value: str) -> int:
    """
    Remove value by clearing exact text node matches.
    
    Args:
        docx_path: Path to DOCX file
        value: Value to remove (e.g., "JOHN DOE")
    
    Returns:
        Number of text nodes cleared
    """
    if not value or not value.strip():
        return 0
    
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        tree = load_xml(document_xml)
        root = tree.getroot()
        
        val_clean = value.strip()
        removed_count = 0
        
        # Find and clear exact matches only
        for text_node in root.xpath("//w:t", namespaces=WORD_NAMESPACE):
            if not text_node.text:
                continue
            
            node_text = text_node.text.strip()
            
            # Clear if EXACT match (case-insensitive for names)
            if node_text.lower() == val_clean.lower():
                text_node.text = ""
                removed_count += 1
                logger.info(f"    ✂️  Cleared text node: '{node_text}'")
        
        # Write back XML
        tree.write(document_xml, encoding="UTF-8", xml_declaration=True)
        
        # Rezip
        zip_docx(temp_dir, docx_path)
        
        return removed_count
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def _remove_value_byte_level(docx_path: str, value: str) -> int:
    """
    Fallback: byte-level replacement in document.xml
    
    Regex pattern: <w:t...>VALUE</w:t>
    Clear by replacing VALUE → "" (preserve tags)
    
    Returns:
        Number of bytes removed
    """
    if not value or not value.strip():
        return 0
    
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        
        with open(document_xml, "rb") as f:
            xml_bytes = f.read()
        
        val_bytes = value.strip().encode("utf-8")
        pattern = b"(<w:t[^>]*>)" + re.escape(val_bytes) + b"(</w:t>)"
        
        replaced = re.sub(pattern, b"\\1\\2", xml_bytes, flags=re.IGNORECASE)
        
        bytes_removed = len(xml_bytes) - len(replaced)
        
        if bytes_removed > 0:
            with open(document_xml, "wb") as f:
                f.write(replaced)
            logger.info(f"    ✂️  Byte-level removal: {bytes_removed} bytes")
        
        zip_docx(temp_dir, docx_path)
        return bytes_removed
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def anonymize_docx(input_path: str, output_path: str, name: str = None, roll_no: str = None) -> dict:
    """
    Anonymize DOCX by removing name and roll number.
    
    Args:
        input_path: Input DOCX file
        output_path: Output anonymized DOCX
        name: Student name to remove
        roll_no: Student roll number to remove
    
    Returns:
        {
            "removed_name": count,
            "removed_roll": count,
            "bytes_removed": total
        }
    """
    import shutil
    
    # Copy input to output first
    shutil.copy(input_path, output_path)
    
    logger.info(f"🔄 Anonymizing {output_path}...")
    
    stats = {
        "removed_name": 0,
        "removed_roll": 0,
        "bytes_removed": 0,
    }
    
    # Remove roll number first (usually numbers, less collision risk)
    if roll_no:
        logger.info(f"  🔍 Removing roll number: {roll_no}")
        count = _remove_value_from_text_nodes(output_path, roll_no)
        if count == 0:
            logger.info(f"  ⚠️  No text nodes matched, trying byte-level...")
            count = _remove_value_byte_level(output_path, roll_no)
        stats["removed_roll"] = count
        stats["bytes_removed"] += count
    
    # Remove name (usually longer text)
    if name:
        logger.info(f"  🔍 Removing name: {name}")
        count = _remove_value_from_text_nodes(output_path, name)
        if count == 0:
            logger.info(f"  ⚠️  No text nodes matched, trying byte-level...")
            count = _remove_value_byte_level(output_path, name)
        stats["removed_name"] = count
        stats["bytes_removed"] += count
    
    logger.info(f"✅ Anonymization complete: {stats}")
    return stats

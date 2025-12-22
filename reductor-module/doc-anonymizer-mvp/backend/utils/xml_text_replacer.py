"""
xml_text_replacer.py

Direct XML text replacement WITHOUT parsing.
This preserves 100% of formatting, spacing, and alignment.
Works by doing byte-level find-replace on the XML file.
"""

import re
from typing import Optional


def replace_text_in_xml(xml_path: str, old_text: str, new_text: str = ""):
    """
    Replace text directly in XML file without parsing.
    This is the ONLY way to guarantee zero whitespace/alignment changes.
    
    Args:
        xml_path: Path to the XML file
        old_text: Text to find (will be escaped for XML)
        new_text: Replacement text (default: empty string for removal)
    """
    if not old_text or not old_text.strip():
        return
    
    # Read the entire XML as bytes
    with open(xml_path, 'rb') as f:
        xml_bytes = f.read()
    
    # Decode to string for replacement
    xml_content = xml_bytes.decode('utf-8')
    
    # The text appears in <w:t>TEXT</w:t> nodes
    # We need to find and replace it while preserving ALL surrounding XML
    
    # Escape special XML characters in the text
    old_escaped = old_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    new_escaped = new_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') if new_text else ""
    
    # Simple direct replacement - if text appears anywhere in the XML, replace it
    # This works because text in DOCX is inside <w:t> tags
    modified_content = xml_content.replace(old_escaped, new_escaped)
    
    # Write back as bytes
    with open(xml_path, 'wb') as f:
        f.write(modified_content.encode('utf-8'))
    
    return modified_content != xml_content  # True if something was replaced


def remove_text_from_xml(xml_path: str, text_to_remove: str):
    """
    Remove text from XML file using direct string replacement.
    100% preserves all formatting, spacing, and structure.
    """
    return replace_text_in_xml(xml_path, text_to_remove, "")

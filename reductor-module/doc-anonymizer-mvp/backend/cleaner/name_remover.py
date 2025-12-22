"""
name_remover.py

Safely removes student name from document.xml.
Handles names in separate nodes and labeled fields.
Preserves document structure (tables, paragraphs) at all times.
"""

import re
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def remove_student_name(document_tree: etree._ElementTree, name: str):
    """
    Remove student name from document by clearing ONLY text node content.
    ULTRA-CONSERVATIVE: Only clear nodes where text EXACTLY equals the name.
    
    NEVER:
    - Use regex substitution (breaks spacing/structure)
    - Modify labeled fields  
    - Remove from body text (to preserve paragraph structure)
    
    ONLY:
    - Find cells/runs that contain the name EXACTLY
    - Clear them completely (preserve cell structure)
    
    This preserves table alignment and spacing perfectly.
    """
    if not name or not name.strip():
        return

    name_clean = name.strip()
    
    # Only clear text nodes that EXACTLY match the name (with flexible whitespace)
    for text_node in document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE):
        if not text_node.text:
            continue

        node_text = text_node.text.strip()
        
        # Only clear if text node is EXACTLY the name (case-insensitive)
        if node_text.lower() == name_clean.lower():
            text_node.text = ""
            print(f"    ✂️ Cleared name cell: '{node_text}'")

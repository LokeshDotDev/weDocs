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
    NEVER delete paragraphs or table cells—just empty their text.
    
    Strategy:
    1. Standalone name nodes (contain only the name) → clear to ""
    2. Labeled fields (NAME + value in same node) → remove just the name part
    3. Global matches (name appearing in body text) → remove with word boundaries
    
    Example transformations:
    'SHIKHA VALECHA '         → ''
    'NAME Shikha Valecha'     → 'NAME '
    'I, Shikha Valecha, say'  → 'I, , say'
    """
    if not name or not name.strip():
        return

    escaped_name = re.escape(name)
    
    # Pattern 1: Label followed by name (remove only the name part, keep label)
    label_pattern = re.compile(
        r'(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|SIGNED\s+BY|AUTHOR)\s*:?\s*' + escaped_name,
        re.IGNORECASE
    )
    
    # Pattern 2: Node contains ONLY the name (possibly with whitespace)
    standalone_pattern = re.compile(
        r'^\s*' + escaped_name + r'\s*$',
        re.IGNORECASE
    )
    
    # Pattern 3: Name with word boundaries (for body text removal)
    global_pattern = re.compile(
        r'\b' + escaped_name + r'\b',
        re.IGNORECASE
    )

    # Process all text nodes
    for text_node in document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE):
        if not text_node.text:
            continue

        original_text = text_node.text

        # Priority 1: If node is ONLY the name (e.g., "SHIKHA VALECHA "), clear it
        if standalone_pattern.match(original_text):
            text_node.text = ""
            print(f"    ✂️ Cleared name node: '{original_text.strip()}'")
            continue

        # Priority 2: Remove labeled field pattern (NAME Shikha Valecha → NAME )
        modified_text = label_pattern.sub(r'\1 ', original_text)
        if modified_text != original_text:
            text_node.text = modified_text
            print(f"    ✂️ Removed from label: '{original_text.strip()}' → '{modified_text.strip()}'")
            continue

        # Priority 3: Remove global name matches (case-insensitive exact phrase)
        modified_text = global_pattern.sub("", original_text)
        if modified_text != original_text:
            text_node.text = modified_text if modified_text else ""
            print(f"    ✂️ Removed global match: '{original_text.strip()}' → '{modified_text.strip()}'")

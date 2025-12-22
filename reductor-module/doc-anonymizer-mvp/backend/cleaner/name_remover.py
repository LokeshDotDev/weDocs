"""
name_remover.py

Safely removes student name from document.xml.
Handles names in separate nodes and labeled fields.
"""

import re
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def remove_student_name(document_tree: etree._ElementTree, name: str):
    """
    Remove student name from document across potentially separate text nodes.
    
    Strategy:
    1. Remove the exact name as a standalone value in a node (e.g., node contains "SHIKHA VALECHA ")
    2. Remove labeled field patterns (e.g., "NAME Shikha Valecha" within same node)
    3. Remove the name anywhere else it appears (global removal with word boundaries)
    
    Example:
    Input nodes: ['NAME ', 'SHIKHA VALECHA ', 'PROGRAM']
    Output nodes: ['NAME ', '', 'PROGRAM']  (or ['', '', 'PROGRAM'] depending on settings)
    
    Input text: "I, Shikha Valecha, declare"
    Output text: "I, , declare"
    """
    if not name or not name.strip():
        return

    # Create patterns
    escaped_name = re.escape(name)
    
    # Pattern 1: Exact standalone name in a node (with optional whitespace)
    standalone_pattern = re.compile(
        r'^\s*' + escaped_name + r'\s*$',
        re.IGNORECASE
    )
    
    # Pattern 2: Labeled field (NAME/ROLL/etc. followed by the name in same node)
    label_pattern = re.compile(
        r'(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|SIGNED\s+BY|AUTHOR)\s*:?\s*' + escaped_name,
        re.IGNORECASE
    )
    
    # Pattern 3: Name anywhere in text with word boundaries
    global_pattern = re.compile(
        r'\b' + escaped_name + r'\b',
        re.IGNORECASE
    )

    for node in document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE):
        if node.text:
            original_text = node.text
            
            # Phase 1: Check if node is ONLY the student name (e.g., "SHIKHA VALECHA ")
            if standalone_pattern.match(original_text):
                node.text = ""
                continue  # Skip other patterns for this node
            
            # Phase 2: Remove labeled field occurrences
            modified_text = label_pattern.sub("", original_text)
            
            # Phase 3: Remove global name matches
            modified_text = global_pattern.sub("", modified_text)
            
            node.text = modified_text if modified_text else ""

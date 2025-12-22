"""
rollno_remover.py

Removes roll number occurrences from document.xml.
Uses regex replacement on text nodes only.
"""

import re
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def remove_roll_number(document_tree: etree._ElementTree, roll_no: str):
    """
    Remove roll number from document.
    ULTRA-CONSERVATIVE: Only clear nodes where text EXACTLY equals the roll number.
    
    Never use regex substitution—this breaks spacing and structure.
    """
    if not roll_no:
        return

    roll_clean = roll_no.strip()

    for node in document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE):
        if not node.text:
            continue

        node_text = node.text.strip()
        
        # Only clear if node is EXACTLY the roll number
        if node_text == roll_clean:
            node.text = ""
            print(f"    ✂️ Cleared roll number cell: '{node_text}'")

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
    Remove all occurrences of roll number from text nodes.
    """
    if not roll_no:
        return

    for node in document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE):
        if node.text and roll_no in node.text:
            node.text = re.sub(re.escape(roll_no), "", node.text)

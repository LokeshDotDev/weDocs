"""
detector.py

Detects student identity (name, roll number) from DOCX XML.
This module ONLY detects — it does NOT remove anything.
"""

import re
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_all_text(document_tree: etree._ElementTree) -> str:
    """
    Extract all visible text from document.xml.
    """
    texts = document_tree.xpath("//w:t", namespaces=WORD_NAMESPACE)
    return " ".join(t.text for t in texts if t.text)


def detect_identity(document_tree: etree._ElementTree) -> dict:
    """
    Detect student identity using label-first node walk, then text patterns.
    Handles all-caps labels/values and values in the next text node.
    """

    def text_nodes(tree):
        return [t.text or "" for t in tree.xpath("//w:t", namespaces=WORD_NAMESPACE)]

    full_text = extract_all_text(document_tree)
    nodes = text_nodes(document_tree)
    detected_name = None
    detected_roll = None
    confidence = "LOW"

    label_re = re.compile(r"^(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|AUTHOR|SIGNED\s+BY)\s*:?\s*(.*)$", re.IGNORECASE)
    roll_re = re.compile(r"^(ROLL\s*NUMBER|ROLL\s*NO|STUDENT\s*ID|ENROLLMENT\s*NO|STUDENT\s*CODE)\s*:?\s*(.*)$", re.IGNORECASE)

    # Phase 1: walk text nodes for labels; value can be on same or next node
    for idx, txt in enumerate(nodes):
        txt_stripped = txt.strip()
        if not txt_stripped:
            continue

        m = label_re.match(txt_stripped)
        if m and not detected_name:
            remainder = m.group(2).strip()
            if remainder:
                detected_name = remainder
            else:
                for nxt in nodes[idx + 1: idx + 4]:
                    if nxt.strip():
                        detected_name = nxt.strip()
                        break
            if detected_name:
                confidence = "HIGH"

        r = roll_re.match(txt_stripped)
        if r and not detected_roll:
            remainder = r.group(2).strip()
            if remainder:
                detected_roll = remainder
            else:
                for nxt in nodes[idx + 1: idx + 4]:
                    if nxt.strip():
                        detected_roll = nxt.strip()
                        break
            if detected_roll:
                confidence = "HIGH"

    # Phase 2: pattern on full text if still missing
    if not detected_name:
        nm = re.search(r'(?:NAME|STUDENT NAME|SUBMITTED BY|AUTHOR|SIGNED BY)\s*[:\-]?\s*([A-Z][A-Za-z]*\s+[A-Z][A-Za-z]*)', full_text, re.IGNORECASE)
        if nm:
            detected_name = nm.group(1).strip()
            confidence = "HIGH"

    if not detected_roll:
        rm = re.search(r'(?:ROLL\s*NUMBER|ROLL\s*NO|STUDENT\s*ID|ENROLLMENT\s*NO|STUDENT\s*CODE)\s*[:\-]?\s*(\d{6,15})', full_text, re.IGNORECASE)
        if rm:
            detected_roll = rm.group(1).strip()
            confidence = "HIGH" if detected_name else "HIGH"

    # Phase 3: proximity to roll (medium)
    if detected_roll and not detected_name:
        roll_idx = full_text.find(detected_roll)
        if roll_idx >= 0:
            context_before = full_text[max(0, roll_idx - 200):roll_idx]
            context_after = full_text[roll_idx:min(len(full_text), roll_idx + 200)]
            full_context = context_before + context_after
            name_candidates = re.findall(r'\b([A-Z][A-Za-z]*\s+[A-Z][A-Za-z]*)\b', full_context)
            if name_candidates:
                names_before = re.findall(r'\b([A-Z][A-Za-z]*\s+[A-Z][A-Za-z]*)\b', context_before)
                detected_name = names_before[-1] if names_before else name_candidates[0]
                confidence = "MEDIUM"

    # Phase 4: weak fallback (low)
    if not detected_name and not detected_roll:
        roll_match_weak = re.search(r'\b(\d{6,15})\b', full_text)
        if roll_match_weak:
            detected_roll = roll_match_weak.group(1)
            confidence = "LOW"
        name_match_weak = re.search(r'\b([A-Z][A-Za-z]*\s+[A-Z][A-Za-z]*)\b', full_text)
        if name_match_weak:
            detected_name = name_match_weak.group(1)
            confidence = "LOW"

    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence,
    }

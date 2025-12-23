"""
identity_detector.py

Smart student identity detection.

CRITICAL:
- Detects ONLY student name and roll number
- Ignores labels, headers, course names
- Operates on text nodes at document start
- Uses regex patterns tuned for academic documents
"""

import re
from lxml import etree
from logger import get_logger

logger = get_logger(__name__)

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_text_nodes(root: etree._Element) -> list:
    """Extract all text node content as list."""
    return [t.text or "" for t in root.xpath("//w:t", namespaces=WORD_NAMESPACE)]


def extract_first_n_lines(root: etree._Element, n: int = 20) -> str:
    """Extract first N text nodes (document start)."""
    texts = extract_text_nodes(root)
    return " ".join(texts[:n]).strip()


def detect_identity(docx_tree: etree._ElementTree) -> dict:
    """
    Detect student identity from DOCX.
    
    Returns:
    {
        "name": "JOHN DOE" or None,
        "roll_no": "123456789" or None,
        "confidence": "HIGH" | "MEDIUM" | "LOW" | "CLEAN"
    }
    """
    root = docx_tree.getroot()
    texts = extract_text_nodes(root)
    first_section = extract_first_n_lines(root, 25)
    
    detected_name = None
    detected_roll = None
    confidence = "LOW"
    
    # Pattern 1: Label + value (NAME: JOHN DOE or NAME: value in next node)
    label_pattern = re.compile(
        r"^(NAME|STUDENT\s+NAME|SUBMITTED\s+BY|AUTHOR)\s*:?\s*(.*)$",
        re.IGNORECASE
    )
    roll_pattern = re.compile(
        r"^(ROLL\s*NO|ROLL\s*NUMBER|STUDENT\s*ID|ENROLLMENT\s*NO)\s*:?\s*(.*)$",
        re.IGNORECASE
    )
    
    for idx, txt in enumerate(texts[:30]):  # Only first 30 nodes
        txt_clean = txt.strip()
        if not txt_clean or len(txt_clean) < 2:
            continue
        
        # Check if this is a NAME label
        m_name = label_pattern.match(txt_clean)
        if m_name and not detected_name:
            value = m_name.group(2).strip()
            if value and len(value) > 2:
                detected_name = value
                confidence = "HIGH"
                logger.info(f"  🔍 Detected name from label: {detected_name}")
            else:
                # Try next node
                for next_idx in range(idx + 1, min(idx + 4, len(texts))):
                    next_txt = texts[next_idx].strip()
                    if next_txt and len(next_txt) > 2 and not next_txt.isnumeric():
                        detected_name = next_txt
                        confidence = "HIGH"
                        logger.info(f"  🔍 Detected name from next node: {detected_name}")
                        break
        
        # Check if this is a ROLL label
        m_roll = roll_pattern.match(txt_clean)
        if m_roll and not detected_roll:
            value = m_roll.group(2).strip()
            if value and re.match(r"^\d{6,15}$", value):
                detected_roll = value
                logger.info(f"  🔍 Detected roll from label: {detected_roll}")
            else:
                # Try next node
                for next_idx in range(idx + 1, min(idx + 4, len(texts))):
                    next_txt = texts[next_idx].strip()
                    if re.match(r"^\d{6,15}$", next_txt):
                        detected_roll = next_txt
                        logger.info(f"  🔍 Detected roll from next node: {detected_roll}")
                        break
    
    # Pattern 2: Regex on first section if still missing
    if not detected_name:
        m = re.search(
            r"(?:NAME|STUDENT\s+NAME|SUBMITTED\s+BY)\s*[:–-]?\s*([A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+)",
            first_section,
            re.IGNORECASE
        )
        if m:
            detected_name = m.group(1).strip()
            confidence = "HIGH"
            logger.info(f"  🔍 Detected name from regex: {detected_name}")
    
    if not detected_roll:
        m = re.search(r"(?:ROLL|ENROLLMENT|ID)\s*[:–-]?\s*(\d{6,15})", first_section, re.IGNORECASE)
        if m:
            detected_roll = m.group(1).strip()
            logger.info(f"  🔍 Detected roll from regex: {detected_roll}")
    
    # If nothing found yet, do weak fallback
    if not detected_name or not detected_roll:
        roll_weak = re.search(r"\b(\d{6,15})\b", first_section)
        name_weak = re.search(r"\b([A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+)\b", first_section)
        
        if roll_weak and not detected_roll:
            detected_roll = roll_weak.group(1)
            confidence = "LOW"
        if name_weak and not detected_name:
            detected_name = name_weak.group(1)
            confidence = "LOW"
    
    # Determine final confidence
    if detected_name and detected_roll:
        confidence = "HIGH"
    elif not detected_name and not detected_roll:
        confidence = "CLEAN"
    
    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence,
    }

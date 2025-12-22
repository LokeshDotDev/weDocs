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
    Detect student identity using LABEL-BASED extraction + global search.
    
    Academic PDFs use labeled fields:
    - "NAME Shikha Valecha" or standalone "SHIKHA VALECHA" near NAME label
    - "ROLL NUMBER 251410503051" or standalone roll numbers
    
    Strategy:
    1. Look for explicit labels (NAME, ROLL NUMBER, etc.)
    2. Extract the value that immediately follows the label
    3. If label found without value in same node, look for next non-empty text
    
    Returns:
    {
        "name": "Shikha Valecha" or None,
        "roll_no": "251410503051" or None,
        "confidence": "HIGH" or "MEDIUM" or "LOW"
    }
    """

    full_text = extract_all_text(document_tree)
    detected_name = None
    detected_roll = None
    confidence = "LOW"

    # Phase 1: Pattern-based detection on full joined text (HIGH CONFIDENCE)
    # Pattern: "NAME Shikha Valecha" or "ROLL NUMBER 251410503051"
    
    # Try to match NAME followed by a capitalized phrase (case-insensitive label)
    name_pattern = re.compile(
        r'(?:NAME|STUDENT NAME|SUBMITTED BY|AUTHOR|SIGNED BY)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        re.IGNORECASE
    )
    name_match = name_pattern.search(full_text)
    if name_match:
        detected_name = name_match.group(1).strip()
        confidence = "HIGH"
    
    # Try to match ROLL NUMBER followed by digits
    roll_pattern = re.compile(
        r'(?:ROLL\s+NUMBER|ROLL\s+NO|STUDENT\s+ID|ENROLLMENT\s+NO|STUDENT\s+CODE)\s*:?\s*(\d{6,15})',
        re.IGNORECASE
    )
    roll_match = roll_pattern.search(full_text)
    if roll_match:
        detected_roll = roll_match.group(1).strip()
        # If we have both roll and name from labels, confidence is HIGH
        if detected_name:
            confidence = "HIGH"
        else:
            confidence = "HIGH"
    
    # Phase 2: Fallback to proximity-based detection (MEDIUM CONFIDENCE)
    # If we found roll but not name, look for capitalized text nearby
    if detected_roll and not detected_name:
        roll_idx = full_text.find(detected_roll)
        if roll_idx >= 0:
            context_before = full_text[max(0, roll_idx - 200):roll_idx]
            context_after = full_text[roll_idx:min(len(full_text), roll_idx + 200)]
            full_context = context_before + context_after
            
            # Look for two capitalized words (likely a name)
            name_candidates = re.findall(r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b', full_context)
            if name_candidates:
                # Prefer names that come before the roll number
                names_before = re.findall(r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b', context_before)
                detected_name = names_before[-1] if names_before else name_candidates[0]
                confidence = "MEDIUM"
    
    # Phase 3: Weak fallback regex (LOW CONFIDENCE)
    # Only if nothing found from labels
    if not detected_name and not detected_roll:
        # Look for roll numbers (6-15 digits)
        roll_match_weak = re.search(r'\b(\d{6,15})\b', full_text)
        if roll_match_weak:
            detected_roll = roll_match_weak.group(1)
            confidence = "LOW"
        
        # Look for names (Firstname Lastname)
        name_match_weak = re.search(r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b', full_text)
        if name_match_weak:
            detected_name = name_match_weak.group(1)
            if not confidence or confidence == "LOW":
                confidence = "LOW"

    return {
        "name": detected_name,
        "roll_no": detected_roll,
        "confidence": confidence
    }

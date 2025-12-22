"""
confidence.py

Evaluates how confident the system is before removing identity.
Prevents accidental deletion of academic content.
"""

def assess_confidence(identity: dict) -> dict:
    """
    Confidence-based removal rules:
    - Roll number: ALWAYS remove if detected
    - Name: ONLY remove if HIGH or MEDIUM confidence
    
    Prefer false negatives (not removing) over false positives (removing wrong data).
    """
    
    confidence = identity.get("confidence", "LOW")
    
    return {
        "remove_roll_no": identity.get("roll_no") is not None,
        "remove_name": identity.get("name") is not None and confidence in ["HIGH", "MEDIUM"],
        "confidence": confidence
    }

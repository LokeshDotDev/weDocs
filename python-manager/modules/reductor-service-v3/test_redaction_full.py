#!/usr/bin/env python3
"""
Test the reductor service end-to-end with a proper test document
"""

import os
import sys
from pathlib import Path

# Add the service to path
service_path = Path(__file__).parent
sys.path.insert(0, str(service_path))

from main import StudentIdentifierExtractor, StudentIdentifierRedactor, DocumentProcessor

def test_reduction():
    """Test the actual reduction process"""
    
    # Test file - use the test document we just created
    test_file = "/tmp/test_business_communication.docx"
    output_file = "/tmp/test_business_communication_redacted.docx"
    
    if not os.path.exists(test_file):
        print(f"❌ Test file not found: {test_file}")
        return False
    
    print(f"✓ Found test file: {test_file}\n")
    
    # Step 1: Read the document
    print("=" * 80)
    print("STEP 1: Reading document")
    print("=" * 80)
    
    try:
        text = DocumentProcessor.read_docx(test_file)
        print(f"✓ Document read successfully")
        print(f"  Total characters: {len(text)}\n")
        print("Document content:")
        print("-" * 80)
        print(text)
        print("-" * 80)
    except Exception as e:
        print(f"❌ Failed to read document: {e}")
        return False
    
    # Step 2: Extract identifiers
    print("\n" + "=" * 80)
    print("STEP 2: Extracting NAME and ROLL NUMBER")
    print("=" * 80)
    
    name, roll_no, confidence = StudentIdentifierExtractor.extract_both(text, strict=True)
    
    print(f"Detected NAME: '{name}' (confidence: {confidence})")
    print(f"Detected ROLL NUMBER: '{roll_no}'")
    
    if not name and not roll_no:
        print("❌ Could not extract any identifiers!")
        return False
    
    # Step 3: Redact identifiers
    print("\n" + "=" * 80)
    print("STEP 3: Redacting identifiers")
    print("=" * 80)
    
    redacted_text, metadata = StudentIdentifierRedactor.redact_both(
        text,
        remove_name=True,
        remove_roll=True,
        preserve_labels=False
    )
    
    print(f"Redacted NAME: {metadata['detected_name']}")
    print(f"Redacted ROLL: {metadata['detected_roll_no']}")
    print(f"Redaction count: {metadata['redaction_count']}\n")
    
    print("Redacted text content:")
    print("-" * 80)
    print(redacted_text)
    print("-" * 80)
    
    # Step 4: Save redacted document
    print("\n" + "=" * 80)
    print("STEP 4: Saving redacted document")
    print("=" * 80)
    
    try:
        replacement_count = DocumentProcessor.modify_docx_in_place(
            test_file,
            output_file,
            name_to_replace=name,
            roll_to_replace=roll_no
        )
        
        print(f"✓ Document saved: {output_file}")
        print(f"  File size: {os.path.getsize(output_file)} bytes")
        
        # Step 5: Verify the output
        print("\n" + "=" * 80)
        print("STEP 5: Verifying redacted document")
        print("=" * 80)
        
        # Read the saved file
        redacted_doc_text = DocumentProcessor.read_docx(output_file)
        
        print(f"✓ Redacted document read successfully")
        print(f"  Total characters: {len(redacted_doc_text)}\n")
        
        print("Redacted document content:")
        print("-" * 80)
        print(redacted_doc_text)
        print("-" * 80)
        
        # Detailed checks
        print("\n" + "=" * 80)
        print("VERIFICATION RESULTS")
        print("=" * 80)
        
        success = True
        
        # Check if NAME is still present
        if name and name in redacted_doc_text:
            print(f"❌ FAIL: NAME '{name}' is STILL PRESENT in redacted document")
            print(f"   Occurrences: {redacted_doc_text.count(name)}")
            success = False
        else:
            print(f"✓ PASS: NAME '{name}' has been removed")
        
        # Check if ROLL NUMBER is still present
        if roll_no and roll_no in redacted_doc_text:
            print(f"❌ FAIL: ROLL NUMBER '{roll_no}' is STILL PRESENT in redacted document")
            print(f"   Occurrences: {redacted_doc_text.count(roll_no)}")
            success = False
        else:
            print(f"✓ PASS: ROLL NUMBER '{roll_no}' has been removed")
        
        # Check if [REDACTED] is present
        redacted_count = redacted_doc_text.count("[REDACTED]")
        print(f"\n[REDACTED] count: {redacted_count}")
        
        if redacted_count >= 2:
            print(f"✓ PASS: Found {redacted_count} [REDACTED] placeholders")
        else:
            print(f"⚠ WARNING: Expected at least 2 [REDACTED] but found {redacted_count}")
        
        if success:
            print("\n" + "=" * 80)
            print("✓✓✓ END-TO-END TEST PASSED ✓✓✓")
            print("=" * 80)
        else:
            print("\n" + "=" * 80)
            print("❌❌❌ END-TO-END TEST FAILED ❌❌❌")
            print("=" * 80)
        
        return success
            
    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_reduction()
    sys.exit(0 if success else 1)

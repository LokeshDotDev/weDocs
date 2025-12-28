#!/usr/bin/env python3
"""
End-to-End Test for Reductor Service v3
Tests actual redaction on a real document
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

# Add the service to path
service_path = Path(__file__).parent
sys.path.insert(0, str(service_path))

from main import StudentIdentifierExtractor, StudentIdentifierRedactor, DocumentProcessor

def test_reduction():
    """Test the actual reduction process"""
    
    # Test file - use the Business communication file
    test_file = Path("/Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode/reductor-module/reductor-service-v2/tmp/Business communication_converted.docx")
    
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        return False
    
    print(f"✓ Found test file: {test_file}")
    print(f"  File size: {test_file.stat().st_size} bytes\n")
    
    # Step 1: Read the document
    print("=" * 80)
    print("STEP 1: Reading document")
    print("=" * 80)
    
    try:
        text = DocumentProcessor.read_docx(str(test_file))
        print(f"✓ Document read successfully")
        print(f"  Total characters: {len(text)}")
        print(f"\nFirst 500 characters of document:")
        print("-" * 80)
        print(text[:500])
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
    print("STEP 3: Redacting identifiers from text")
    print("=" * 80)
    
    redacted_text, metadata = StudentIdentifierRedactor.redact_both(
        text,
        remove_name=True,
        remove_roll=True,
        preserve_labels=False
    )
    
    print(f"Redacted NAME: {metadata['detected_name']}")
    print(f"Redacted ROLL: {metadata['detected_roll_no']}")
    print(f"Redaction count: {metadata['redaction_count']}")
    
    # Check if redaction happened in memory
    if "[REDACTED]" not in redacted_text:
        print("❌ Text was not redacted in memory!")
        return False
    
    print(f"✓ Text redacted in memory")
    print(f"  Original NAME occurrences: {text.count(name) if name else 0}")
    print(f"  Redacted NAME occurrences: {redacted_text.count(name) if name else 0}")
    print(f"  [REDACTED] count in text: {redacted_text.count('[REDACTED]')}")
    
    # Step 4: Save redacted document
    print("\n" + "=" * 80)
    print("STEP 4: Saving redacted document")
    print("=" * 80)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        output_file = os.path.join(tmpdir, "test_output.docx")
        
        try:
            replacement_count = DocumentProcessor.modify_docx_in_place(
                str(test_file),
                output_file,
                name_to_replace=name,
                roll_to_replace=roll_no
            )
            
            print(f"✓ Document saved: {output_file}")
            print(f"  Replacements made: {replacement_count}")
            
            # Step 5: Verify the output
            print("\n" + "=" * 80)
            print("STEP 5: Verifying redacted document")
            print("=" * 80)
            
            # Read the saved file
            redacted_doc_text = DocumentProcessor.read_docx(output_file)
            
            print(f"✓ Redacted document read successfully")
            print(f"  Total characters: {len(redacted_doc_text)}")
            print(f"\nFirst 500 characters of redacted document:")
            print("-" * 80)
            print(redacted_doc_text[:500])
            print("-" * 80)
            
            # Check if NAME is still present
            if name and name in redacted_doc_text:
                print(f"\n❌ FAIL: NAME '{name}' is STILL present in redacted document!")
                print(f"  Occurrences: {redacted_doc_text.count(name)}")
                return False
            else:
                print(f"\n✓ PASS: NAME is NOT present in redacted document")
            
            # Check if ROLL NUMBER is still present
            if roll_no and roll_no in redacted_doc_text:
                print(f"❌ FAIL: ROLL NUMBER '{roll_no}' is STILL present in redacted document!")
                print(f"  Occurrences: {redacted_doc_text.count(roll_no)}")
                return False
            else:
                print(f"✓ PASS: ROLL NUMBER is NOT present in redacted document")
            
            # Check if [REDACTED] is present
            if "[REDACTED]" in redacted_doc_text:
                print(f"✓ PASS: [REDACTED] placeholders are present")
                print(f"  Occurrences: {redacted_doc_text.count('[REDACTED]')}")
            else:
                print(f"⚠ WARNING: [REDACTED] placeholders NOT found")
            
            print("\n" + "=" * 80)
            print("✓✓✓ END-TO-END TEST PASSED ✓✓✓")
            print("=" * 80)
            return True
            
        except Exception as e:
            print(f"❌ Failed to save/verify document: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = test_reduction()
    sys.exit(0 if success else 1)

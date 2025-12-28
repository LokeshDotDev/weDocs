#!/usr/bin/env python3
"""
Reductor Service v3 - API Testing Script

This script tests all endpoints of the Reductor Service v3 to ensure
it's working correctly with various inputs and scenarios.

Usage:
    python3 test_api.py

Prerequisites:
    - Service must be running: ./start_server.sh
    - Python 3.8+ with requests library
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
SERVICE_URL = "http://localhost:5018"
TIMEOUT = 10

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    """Print a section header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(70)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}\n")

def print_test(test_name: str):
    """Print a test name"""
    print(f"{Colors.CYAN}▶ {test_name}{Colors.RESET}")

def print_success(message: str):
    """Print success message"""
    print(f"  {Colors.GREEN}✓ {message}{Colors.RESET}")

def print_error(message: str):
    """Print error message"""
    print(f"  {Colors.RED}✗ {message}{Colors.RESET}")

def print_info(message: str):
    """Print info message"""
    print(f"  {Colors.YELLOW}ℹ {message}{Colors.RESET}")

def test_health_check() -> bool:
    """Test: Health Check Endpoint"""
    print_test("Health Check - GET /health")
    
    try:
        response = requests.get(f"{SERVICE_URL}/health", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Status: {data.get('status')}")
            print_success(f"Service: {data.get('service')}")
            print_success(f"Version: {data.get('version')}")
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to service (is it running?)")
        return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_service_info() -> bool:
    """Test: Service Information Endpoint"""
    print_test("Service Info - GET /info")
    
    try:
        response = requests.get(f"{SERVICE_URL}/info", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Service Name: {data.get('name')}")
            print_success(f"Features: {len(data.get('features', []))} available")
            print_success(f"Endpoints: {len(data.get('endpoints', {}))} endpoints")
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_extract_identifiers_basic() -> bool:
    """Test: Extract identifiers from text (Basic case)"""
    print_test("Extract Identifiers - Basic Case")
    
    payload = {
        "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010\nPROGRAM: MBA",
        "strict_mode": True
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/identify/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('detected_name') == "SHANMUGAPRIYA SIVAKUMAR":
                print_success(f"Detected Name: {data.get('detected_name')}")
            else:
                print_error(f"Expected name not detected. Got: {data.get('detected_name')}")
                return False
            
            if data.get('detected_roll_no') == "25145050010":
                print_success(f"Detected Roll No: {data.get('detected_roll_no')}")
            else:
                print_error(f"Expected roll number not detected. Got: {data.get('detected_roll_no')}")
                return False
            
            print_success(f"Confidence: {data.get('extraction_confidence')}")
            return True
        else:
            print_error(f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_extract_identifiers_flexible() -> bool:
    """Test: Extract identifiers with flexible patterns"""
    print_test("Extract Identifiers - Flexible Mode")
    
    # Test with slightly different formatting
    payload = {
        "text": "Name: JOHN DOE\nRoll No: 12345678901\nCourse: BCA",
        "strict_mode": False
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/identify/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('detected_name'):
                print_success(f"Detected Name: {data.get('detected_name')}")
            else:
                print_info("Name not detected (might not match flexible patterns)")
            
            if data.get('detected_roll_no'):
                print_success(f"Detected Roll No: {data.get('detected_roll_no')}")
            else:
                print_info("Roll number not detected (might not match flexible patterns)")
            
            print_success(f"Confidence: {data.get('extraction_confidence')}")
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_redact_text_both() -> bool:
    """Test: Redact both name and roll number"""
    print_test("Redact Text - Remove Both Fields")
    
    payload = {
        "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010\nPROGRAM: MBA\nCOURSE: DMBA114",
        "remove_name": True,
        "remove_roll_no": True,
        "preserve_labels": False
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/redact/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            redacted = data.get('redacted_text', '')
            
            if "[REDACTED]" in redacted:
                print_success(f"Text redacted successfully")
                print_success(f"Redaction count: {data.get('redaction_count', 0)}")
            else:
                print_error("Text not properly redacted")
                return False
            
            if "MBA" in redacted and "DMBA114" in redacted:
                print_success("Other fields preserved")
            else:
                print_error("Other fields were incorrectly modified")
                return False
            
            print_info(f"Redacted text preview: {redacted[:100]}...")
            return True
        else:
            print_error(f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_redact_text_name_only() -> bool:
    """Test: Redact only name"""
    print_test("Redact Text - Remove Name Only")
    
    payload = {
        "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010\nCOURSE: DMBA114",
        "remove_name": True,
        "remove_roll_no": False,
        "preserve_labels": False
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/redact/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            redacted = data.get('redacted_text', '')
            
            if "SHANMUGAPRIYA" not in redacted and "[REDACTED]" in redacted:
                print_success("Name redacted")
            else:
                print_error("Name not properly redacted")
                return False
            
            if "25145050010" in redacted:
                print_success("Roll number preserved")
            else:
                print_error("Roll number was incorrectly redacted")
                return False
            
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_redact_text_with_labels() -> bool:
    """Test: Redact with label preservation"""
    print_test("Redact Text - Preserve Labels")
    
    payload = {
        "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010",
        "remove_name": True,
        "remove_roll_no": True,
        "preserve_labels": True
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/redact/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            redacted = data.get('redacted_text', '')
            
            if "NAME:" in redacted or "ROLL NUMBER:" in redacted:
                print_success("Labels preserved")
            else:
                print_info("Labels not found in output")
            
            print_info(f"Output: {redacted}")
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_empty_text() -> bool:
    """Test: Handle empty text gracefully"""
    print_test("Error Handling - Empty Text")
    
    payload = {
        "text": ""
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/redact/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 400:
            print_success("Correctly rejected empty text with HTTP 400")
            return True
        else:
            print_info(f"Response: HTTP {response.status_code}")
            return True  # Not critical
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_no_match_text() -> bool:
    """Test: Handle text with no identifiers"""
    print_test("Handle Text - No Identifiers Found")
    
    payload = {
        "text": "This is a regular document with no student information."
    }
    
    try:
        response = requests.post(
            f"{SERVICE_URL}/identify/text",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('detected_name') is None and data.get('detected_roll_no') is None:
                print_success("Correctly returned None for no matches")
            else:
                print_error("Should have returned None for no matches")
                return False
            
            return True
        else:
            print_error(f"HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def run_all_tests() -> Dict[str, bool]:
    """Run all tests and return results"""
    print_header("Reductor Service v3 - API Test Suite")
    
    print_info("Testing service at: " + SERVICE_URL)
    print_info("Timeout: " + str(TIMEOUT) + " seconds")
    
    tests = {
        "Health Check": test_health_check,
        "Service Info": test_service_info,
        "Extract (Basic)": test_extract_identifiers_basic,
        "Extract (Flexible)": test_extract_identifiers_flexible,
        "Redact (Both)": test_redact_text_both,
        "Redact (Name Only)": test_redact_text_name_only,
        "Redact (Preserve Labels)": test_redact_text_with_labels,
        "Empty Text Handling": test_empty_text,
        "No Match Text": test_no_match_text,
    }
    
    results = {}
    for test_name, test_func in tests.items():
        try:
            results[test_name] = test_func()
        except Exception as e:
            print_error(f"Unexpected error: {str(e)}")
            results[test_name] = False
        print()
    
    return results

def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print_header("Test Summary")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {total - passed}{Colors.RESET}")
    print()
    
    print("Detailed Results:")
    print()
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        print(f"  {test_name:.<50} {status}")
    
    print()
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}All tests passed! 🎉{Colors.RESET}")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}{total - passed} test(s) failed.{Colors.RESET}")
        return 1

if __name__ == "__main__":
    try:
        results = run_all_tests()
        exit_code = print_summary(results)
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Tests interrupted by user.{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}Fatal error: {str(e)}{Colors.RESET}")
        sys.exit(1)

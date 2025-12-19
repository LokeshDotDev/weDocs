"""
Test script for Binoculars AI Detection API
"""
import requests
import json

API_URL = "http://localhost:5000"

def test_health():
    """Test health endpoint"""
    print("=" * 60)
    print("Testing /health endpoint...")
    print("=" * 60)
    
    response = requests.get(f"{API_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    print()

def test_single_detection():
    """Test single text detection"""
    print("=" * 60)
    print("Testing /detect endpoint...")
    print("=" * 60)
    
    # AI-generated text sample
    text = """Dr. Capy Cosmos, a capybara unlike any other, astounded the scientific community with his 
groundbreaking research in astrophysics. With his keen sense of observation and unparalleled ability to interpret 
cosmic data, he uncovered new insights into the mysteries of black holes and the origins of the universe."""
    
    print(f"Analyzing text: {text[:100]}...")
    print("\n⏳ This will take 10-25 seconds on first run (downloading models)...")
    print("   Subsequent runs will be instant (~1-3 seconds)\n")
    
    response = requests.post(
        f"{API_URL}/detect",
        json={"text": text},
        timeout=120  # 2 minute timeout for first run
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {json.dumps(result, indent=2)}")
    print()
    
    if 'aiPercentage' in result:
        print(f"✅ Detection successful!")
        print(f"   AI Percentage: {result['aiPercentage']}%")
        print(f"   Prediction: {result['prediction']}")

def test_human_text():
    """Test with human-written text"""
    print("=" * 60)
    print("Testing with human-written text...")
    print("=" * 60)
    
    text = "I went to the store yesterday. It was pretty crowded but I managed to get everything I needed."
    
    print(f"Analyzing text: {text}")
    
    response = requests.post(
        f"{API_URL}/detect",
        json={"text": text},
        timeout=60
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {json.dumps(result, indent=2)}")
    print()
    
    if 'aiPercentage' in result:
        print(f"✅ Detection successful!")
        print(f"   AI Percentage: {result['aiPercentage']}%")
        print(f"   Prediction: {result['prediction']}")

if __name__ == '__main__':
    try:
        print("\n🧪 Binoculars AI Detection API - Test Suite\n")
        
        # Test 1: Health check
        test_health()
        
        # Test 2: Single detection (AI-generated)
        test_single_detection()
        
        # Test 3: Human text
        test_human_text()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to API")
        print("   Make sure the Flask server is running:")
        print("   python api.py")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")

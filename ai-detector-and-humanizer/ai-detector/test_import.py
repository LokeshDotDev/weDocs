"""Quick test of Binoculars import"""
import sys
import os

# Add binoculars to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing Binoculars import...")
try:
    from binoculars import Binoculars
    print("✅ Import successful!")
    
    print("\nInitializing Binoculars (this will download models - ~15GB)...")
    bino = Binoculars(mode="accuracy")
    print("✅ Initialization successful!")
    
    print("\nTesting detection...")
    text = "This is a test sentence."
    score = bino.compute_score(text)
    prediction = bino.predict(text)
    
    print(f"✅ Detection works!")
    print(f"   Score: {score}")
    print(f"   Prediction: {prediction}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

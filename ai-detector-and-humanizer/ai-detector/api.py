"""
Flask API for Binoculars AI Detection - Local Development
Provides REST endpoint for the backend to detect AI-generated text
"""
import os
import sys

# Set HuggingFace cache to D: drive (more space than C:)
# IMPORTANT: Set this BEFORE importing any HuggingFace libraries
os.environ['HF_HOME'] = r'D:\huggingface_cache'
os.environ['TRANSFORMERS_CACHE'] = r'D:\huggingface_cache\transformers'
os.environ['HF_DATASETS_CACHE'] = r'D:\huggingface_cache\datasets'
os.environ['HF_OFFLOAD_FOLDER'] = r'D:\huggingface_cache\offload'

print("=" * 60)
print("📦 HuggingFace Cache Location")
print("=" * 60)
print(f"   Cache directory: {os.environ['HF_HOME']}")
print(f"   Models will be stored on D: drive (more space)")
print("=" * 60)
print()

from flask import Flask, request, jsonify
from flask_cors import CORS

# Add the binoculars module to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)  # Allow requests from Node.js backend

# Global variable to store the Binoculars instance
binoculars_instance = None

def initialize_binoculars():
    """Initialize Binoculars detector (loads models - takes ~10-25 seconds first time)"""
    global binoculars_instance
    if binoculars_instance is None:
        print("🔄 Initializing Binoculars detector...")
        print("📥 Downloading models (first time only - ~15GB)...")
        print("⏳ This will take 10-25 seconds on first run, instant on subsequent runs")
        
        from binoculars import Binoculars
        # Fallback to smaller models by default on CPU to avoid OOM/segfaults.
        # Set BINOCULARS_SMALL_MODELS=0 to force Falcon-7B variants.
        use_small_models = os.environ.get("BINOCULARS_SMALL_MODELS", "1") == "1"
        if use_small_models:
            print("⚙️ Using smaller Falcon models (rw-1b) to reduce memory usage")
            binoculars_instance = Binoculars(
                observer_name_or_path="tiiuae/falcon-rw-1b",
                performer_name_or_path="tiiuae/falcon-rw-1b",
                use_bfloat16=True,
                mode="accuracy",
            )
        else:
            binoculars_instance = Binoculars(mode="accuracy")
        
        print("✅ Binoculars initialized successfully!")
    return binoculars_instance

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'binoculars-detector',
        'initialized': binoculars_instance is not None
    })

@app.route('/detect', methods=['POST'])
def detect():
    """
    Detect if text is AI-generated
    
    Request body:
    {
        "text": "Text to analyze..."
    }
    
    Response:
    {
        "score": 0.756,
        "prediction": "Most likely AI-Generated",
        "isAIGenerated": true,
        "aiPercentage": 75.6
    }
    """
    try:
        # Get text from request
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': 'Missing required field: text'
            }), 400
        
        text = data['text']
        
        if not text or len(text.strip()) == 0:
            return jsonify({
                'error': 'Text cannot be empty'
            }), 400
        
        # Initialize Binoculars if needed
        bino = initialize_binoculars()
        
        # Perform detection
        print(f"🔍 Analyzing text ({len(text)} characters)...")
        score = bino.compute_score(text)
        prediction = bino.predict(text)
        
        # Calculate AI percentage (score closer to 1 = more AI-like)
        ai_percentage = round(score * 100, 2)
        is_ai_generated = score > 0.5
        
        result = {
            'score': round(score, 4),
            'prediction': prediction,
            'isAIGenerated': is_ai_generated,
            'aiPercentage': ai_percentage
        }
        
        print(f"✅ Detection complete: {ai_percentage}% AI-generated")
        
        return jsonify(result)
    
    except Exception as e:
        print(f"❌ Error during detection: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/batch-detect', methods=['POST'])
def batch_detect():
    """
    Detect AI-generated text for multiple texts
    
    Request body:
    {
        "texts": ["Text 1...", "Text 2...", ...]
    }
    
    Response:
    {
        "results": [
            {"score": 0.756, "prediction": "...", "isAIGenerated": true, "aiPercentage": 75.6},
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'error': 'Missing required field: texts'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({
                'error': 'texts must be a non-empty array'
            }), 400
        
        # Initialize Binoculars if needed
        bino = initialize_binoculars()
        
        # Process each text
        results = []
        print(f"🔍 Analyzing {len(texts)} texts...")
        
        for i, text in enumerate(texts):
            if not text or len(text.strip()) == 0:
                results.append({
                    'error': 'Empty text',
                    'score': None,
                    'prediction': None,
                    'isAIGenerated': None,
                    'aiPercentage': None
                })
                continue
            
            try:
                score = bino.compute_score(text)
                prediction = bino.predict(text)
                ai_percentage = round(score * 100, 2)
                is_ai_generated = score > 0.5
                
                results.append({
                    'score': round(score, 4),
                    'prediction': prediction,
                    'isAIGenerated': is_ai_generated,
                    'aiPercentage': ai_percentage
                })
                
                print(f"  [{i+1}/{len(texts)}] {ai_percentage}% AI-generated")
                
            except Exception as e:
                results.append({
                    'error': str(e),
                    'score': None,
                    'prediction': None,
                    'isAIGenerated': None,
                    'aiPercentage': None
                })
        
        print(f"✅ Batch detection complete")
        
        return jsonify({'results': results})
    
    except Exception as e:
        print(f"❌ Error during batch detection: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting Binoculars AI Detection API")
    print("=" * 60)
    print("")
    print("📍 API will be available at: http://localhost:5000")
    print("")
    print("Available endpoints:")
    print("  GET  /health        - Health check")
    print("  POST /detect        - Detect AI in single text")
    print("  POST /batch-detect  - Detect AI in multiple texts")
    print("")
    print("⏳ Starting server...")
    print("   (Models will load on first request - ~10-25 seconds)")
    print("")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=False)

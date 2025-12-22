"""
Flask API for Binoculars AI Detection - Local Development
Provides REST endpoint for the backend to detect AI-generated text
"""
import os
import sys
import pathlib

# Prefer existing HF_* envs; if not set and running on macOS, fallback to external SSD cache if present
if not os.environ.get("HF_HOME"):
    if sys.platform == "darwin":
        candidate = pathlib.Path("/Volumes/Vivek Data/hf-cache")
        if candidate.exists():
            os.environ['HF_HOME'] = str(candidate)
            os.environ['TRANSFORMERS_CACHE'] = str(candidate / "transformers")
            os.environ['HF_DATASETS_CACHE'] = str(candidate / "datasets")
            os.environ['HF_OFFLOAD_FOLDER'] = str(candidate / "offload")

print("=" * 60)
print("📦 HuggingFace Cache Location")
print("=" * 60)
print(f"   Cache directory: {os.environ.get('HF_HOME', '(default)')}")
print("=" * 60)
print()

from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    import torch
    # Use all CPU threads unless explicitly limited
    cpu_threads = max(1, os.cpu_count() or 1)
    torch.set_num_threads(cpu_threads)
    if hasattr(torch, "set_num_interop_threads"):
        torch.set_num_interop_threads(max(1, (os.cpu_count() or 1) // 2))
    # Enable MPS fallback if available on Apple Silicon
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    print(f"⚙️  Torch threads: {torch.get_num_threads()} (interop: {getattr(torch, 'get_num_interop_threads', lambda: 'n/a')() if hasattr(torch, 'get_num_interop_threads') else 'n/a'})")
    if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available():
        print("🚀 MPS (Apple GPU) is available – PyTorch will offload compatible ops.")
except Exception as _torch_err:
    print(f"ℹ️  Torch not tuned: {_torch_err}")

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
        print("⏱️  [3%] Preparing models...", flush=True)
        bino = initialize_binoculars()
        print("⏱️  [25%] Models ready", flush=True)
        
        # Perform detection with staged progress logs
        print(f"🔍 Analyzing text ({len(text)} characters)...", flush=True)
        print("⏱️  [50%] Computing score...", flush=True)
        score = bino.compute_score(text)
        print("⏱️  [85%] Deriving label...", flush=True)
        # Derive prediction from score using Binoculars threshold to avoid recomputation
        threshold = getattr(bino, 'threshold', 0.5)
        prediction = "Most likely human-generated" if float(score) >= float(threshold) else "Most likely AI-generated"
        
        # Calculate AI percentage (score closer to 1 = more AI-like)
        # Clamp score to [0,1] to avoid >100% readings
        score_clamped = max(0.0, min(1.0, float(score)))
        ai_percentage = round(score_clamped * 100, 2)
        is_ai_generated = score_clamped > 0.5
        
        result = {
            'score': round(score_clamped, 4),
            'prediction': prediction,
            'isAIGenerated': is_ai_generated,
            'aiPercentage': ai_percentage
        }
        
        print(f"✅ Detection complete: {ai_percentage}% AI-generated", flush=True)
        
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
        
        # Prefer true batched inference for significant speedups
        print(f"🔍 Analyzing {len(texts)} texts (batched)...")
        try:
            scores = bino.compute_score(texts)
        except Exception as e:
            print(f"❌ Error during batched compute: {e}. Falling back to per-text.")
            scores = []
            for t in texts:
                try:
                    scores.append(bino.compute_score(t))
                except Exception as ie:
                    scores.append(None)

        threshold = getattr(bino, 'threshold', 0.5)
        results = []
        for s in scores:
            if s is None:
                results.append({
                    'error': 'scoring_failed',
                    'score': None,
                    'prediction': None,
                    'isAIGenerated': None,
                    'aiPercentage': None
                })
                continue
            s_clamped = max(0.0, min(1.0, float(s)))
            ai_pct = round(s_clamped * 100, 2)
            pred = "Most likely human-generated" if s_clamped >= float(threshold) else "Most likely AI-generated"
            results.append({
                'score': round(s_clamped, 4),
                'prediction': pred,
                'isAIGenerated': s_clamped > 0.5,
                'aiPercentage': ai_pct
            })

        print(f"✅ Batch detection complete (batched path)")

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
    print("📍 API will be available at: http://localhost:5003")
    print("")
    print("Available endpoints:")
    print("  GET  /health        - Health check")
    print("  POST /detect        - Detect AI in single text")
    print("  POST /batch-detect  - Detect AI in multiple texts")
    print("")
    print("⏳ Starting server...")
    print("   (Models will load on first request - ~10-25 seconds)")
    print("")
    
    # Run Flask app on port 5003 (Python Manager uses 5000)
    app.run(host='0.0.0.0', port=5003, debug=False)

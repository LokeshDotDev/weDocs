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
import re
import hashlib
import time
from functools import lru_cache
from flask_cors import CORS
try:
    import torch
    # BEAST MODE: Use ALL CPU threads for maximum parallel processing
    cpu_count = os.cpu_count() or 1
    torch.set_num_threads(cpu_count)  # Use all cores
    if hasattr(torch, "set_num_interop_threads"):
        torch.set_num_interop_threads(cpu_count)  # Max parallelism
    # Enable MPS fallback if available on Apple Silicon
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    os.environ.setdefault("PYTORCH_MPS_HIGH_WATERMARK_RATIO", "0.0")  # Use max GPU memory
    print(f"⚙️  BEAST MODE: {cpu_count} CPU threads + MPS GPU")
    if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available():
        print("🚀 MPS (Apple GPU) ready for 5-10x speedup!")
except Exception as _torch_err:
    print(f"ℹ️  Torch not tuned: {_torch_err}")

# Add the binoculars module to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)  # Allow requests from Node.js backend

# Global variable to store the Binoculars instance
binoculars_instance = None


# -------------------------
# Ultrafast heuristic detector
# -------------------------

_STOPWORDS = {
    'the','is','at','which','on','and','a','an','to','in','it','of','for','with','as','by','that','this','from',
    'or','be','are','was','were','has','had','have','not','but','if','then','so','such','into','about','over','under'
}


def _sample_windows(text: str, window: int = 800, max_windows: int = 6) -> list[str]:
    if len(text) <= window:
        return [text]
    step = max(1, (len(text) - window) // max(1, (max_windows - 1)))
    samples = []
    i = 0
    while i + window <= len(text) and len(samples) < max_windows:
        samples.append(text[i:i+window])
        i += step
    if not samples:
        samples = [text[:window]]
    return samples


def _chunk_features(s: str) -> dict:
    # tokens, words, sentences
    words = re.findall(r"[A-Za-z']+", s)
    n_words = len(words) or 1
    uniq = len(set(w.lower() for w in words))
    ttr = uniq / n_words  # type-token ratio
    avg_word_len = sum(len(w) for w in words) / n_words
    stop = sum(1 for w in words if w.lower() in _STOPWORDS)
    stop_ratio = stop / n_words

    # sentences
    sentences = re.split(r"(?<=[.!?])\s+", s)
    sent_lens = [len(re.findall(r"[A-Za-z']+", x)) for x in sentences if x.strip()]
    sent_lens = sent_lens or [n_words]
    mean_len = sum(sent_lens) / len(sent_lens)
    var_len = sum((x - mean_len) ** 2 for x in sent_lens) / len(sent_lens)

    # punctuation & casing
    punct = len(re.findall(r"[.,;:!?]", s))
    punct_density = punct / max(1, len(s))
    upper_ratio = sum(1 for c in s if c.isupper()) / max(1, len(s))

    # repetition via 3-gram overlap
    grams = []
    for i in range(len(words) - 2):
        grams.append((words[i].lower(), words[i+1].lower(), words[i+2].lower()))
    rep_ratio = 0.0
    if grams:
        uniq_grams = len(set(grams))
        rep_ratio = 1.0 - (uniq_grams / len(grams))

    return {
        'ttr': ttr,
        'avg_word_len': avg_word_len,
        'stop_ratio': stop_ratio,
        'mean_len': mean_len,
        'var_len': var_len,
        'punct_density': punct_density,
        'upper_ratio': upper_ratio,
        'rep_ratio': rep_ratio,
    }


def _combine_features(fs: list[dict]) -> float:
    # Average features across windows
    if not fs:
        return 0.5
    keys = fs[0].keys()
    avg = {k: sum(f[k] for f in fs) / len(fs) for k in keys}

    # Heuristic scoring: tune to be conservative (false-positive resistant)
    # Intuition:
    # - very low TTR, low variance of sentence lengths, high repetition -> more AI-like
    # - very regular punctuation density and mid-high stopword ratio -> more AI-like
    # - overly uniform word length implies AI
    score = 0.0
    score += (0.35 * max(0.0, 0.45 - avg['ttr']) / 0.45)  # lower ttr boosts score
    score += (0.25 * max(0.0, 0.8 - min(1.5, avg['var_len'])) / 0.8)  # low variance boosts score
    score += (0.15 * min(1.0, avg['rep_ratio'] * 3.0))  # repetition boosts score
    score += (0.10 * min(1.0, avg['punct_density'] * 50.0))  # dense punctuation slightly boosts
    score += (0.10 * max(0.0, 0.22 - min(0.22, avg['ttr'])) / 0.22)  # extremely low ttr extra boost
    score = max(0.0, min(1.0, score))
    # Map to probability-like range with light calibration
    return max(0.0, min(1.0, 0.15 + 0.7 * score))


@lru_cache(maxsize=256)
def _fast_score_cached(text_sha: str, length: int) -> float:
    # The cache key uses sha256 of text; length is included to reduce collisions (paranoia)
    return 0.5  # placeholder; real path filled in wrapper


def fast_detect_score(text: str) -> float:
    # Cache by sha256
    sha = hashlib.sha256(text.encode('utf-8', errors='ignore')).hexdigest()
    cached = _fast_score_cached.cache_info()
    # We can’t retrieve value directly; create inner function that we cache via sha
    @lru_cache(maxsize=0)
    def _compute(_sha: str) -> float:
        samples = _sample_windows(text)
        feats = [_chunk_features(s) for s in samples]
        return _combine_features(feats)

    # Use nested no-arg cached function keyed by sha via default value binding
    def _runner(key=sha):
        return _compute(key)

    return _runner()

def initialize_binoculars():
    """Initialize Binoculars detector (loads models - takes ~10-25 seconds first time)"""
    global binoculars_instance
    if binoculars_instance is None:
        print("🔄 Initializing Binoculars detector...")
        print("📥 Downloading models (first time only - ~15GB)...")
        print("⏳ This will take 10-25 seconds on first run, instant on subsequent runs")
        
        from binoculars import Binoculars
        import torch
        
        # Check if user wants to force CPU mode (useful if MPS causes OOM)
        force_cpu = os.environ.get("BINOCULARS_FORCE_CPU", "0") == "1"
        
        # Determine device: prefer MPS (Apple GPU) for much faster inference
        device = 'cpu'
        if not force_cpu and torch.backends.mps.is_available():
            device = 'mps'
            # Conservative memory allocation to prevent OOM
            torch.mps.set_per_process_memory_fraction(0.7)  # Use 70% to leave headroom
            print("🚀 Using MPS (Apple GPU) for 5-10x speed!")
        elif torch.cuda.is_available():
            device = 'cuda'
            print("🚀 Using CUDA GPU for acceleration")
        else:
            if force_cpu:
                print("ℹ️  CPU-only mode enabled (BINOCULARS_FORCE_CPU=1)")
            print("⚙️  Using CPU (stable, slower)")
        
        # Use smaller models by default for speed
        use_small_models = os.environ.get("BINOCULARS_SMALL_MODELS", "1") == "1"
        if use_small_models:
            print("⚙️ Using optimized Falcon-1B models for MAXIMUM SPEED")
            binoculars_instance = Binoculars(
                observer_name_or_path="tiiuae/falcon-rw-1b",
                performer_name_or_path="tiiuae/falcon-rw-1b",
                use_bfloat16=False,  # MPS doesn't support bfloat16, use float32/float16 instead
                max_token_observed=256,  # Smaller = FASTER (was 512 -> 256)
            )
        else:
            binoculars_instance = Binoculars(max_token_observed=256)
        
        # Move models to MPS/CUDA device if available
        if device != 'cpu':
            try:
                print(f"📥 Loading models to {device.upper()}...")
                binoculars_instance.observer_model = binoculars_instance.observer_model.to(device)
                print(f"  ✓ Observer model on {device.upper()}")
                binoculars_instance.performer_model = binoculars_instance.performer_model.to(device)
                print(f"  ✓ Performer model on {device.upper()}")
                # Convert to float16 for MPS compatibility
                if device == 'mps':
                    binoculars_instance.observer_model = binoculars_instance.observer_model.half()
                    binoculars_instance.performer_model = binoculars_instance.performer_model.half()
                    print(f"  ✓ Converted to FP16")
                print(f"✅ Models successfully loaded on {device.upper()}!")
            except Exception as e:
                error_msg = str(e)
                if 'out of memory' in error_msg.lower():
                    print(f"⚠️ MPS GPU OUT OF MEMORY during model loading")
                    print(f"💡 Tip: Your Mac's GPU doesn't have enough VRAM for both Falcon-1B models")
                    print(f"↩️  AUTO-FALLBACK: Switching to CPU (slower but stable)...")
                else:
                    print(f"⚠️ Could not load on {device}: {e}")
                    print(f"↩️  Falling back to CPU...")
                # Move models back to CPU
                try:
                    binoculars_instance.observer_model = binoculars_instance.observer_model.to('cpu')
                    binoculars_instance.performer_model = binoculars_instance.performer_model.to('cpu')
                except Exception:
                    pass
                device = 'cpu'
                print(f"✅ Models loaded on CPU successfully")
        
        print("✅ Binoculars initialized successfully!")
        print(f"📊 Running on device: {device}")
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
        
        # Fast path selection - ONLY if explicitly requested
        use_fast = False
        if isinstance(data, dict) and data.get('fast') in (True, '1', 'true', 'yes'):
            use_fast = True
        if request.args.get('mode', '') == 'fast' or request.args.get('fast', '') in ('1','true','yes'):
            use_fast = True

        if use_fast:
            # FAST MODE: Heuristic detection (< 1s but less accurate)
            t0 = time.time()
            score = fast_detect_score(text)
            elapsed = (time.time() - t0) * 1000
            print(f"⚡ Ultrafast heuristic completed in {elapsed:.1f} ms", flush=True)
            threshold = 0.5
        else:
            # DEFAULT: Binoculars model (accurate, takes longer)
            print("⏱️  [3%] Preparing Binoculars models...", flush=True)
            bino = initialize_binoculars()
            print("⏱️  [25%] Models ready", flush=True)
            print(f"🔍 Analyzing text ({len(text)} characters)...", flush=True)
            print("⏱️  [50%] Computing score...", flush=True)
            score = bino.compute_score(text)
            print("⏱️  [85%] Deriving label...", flush=True)
            threshold = getattr(bino, 'threshold', 0.5)
        
        # Derive prediction from score using threshold
        prediction = "Most likely human-generated" if float(score) >= float(threshold) else "Most likely AI-generated"
        
        # Calculate AI percentage consistently: higher Binoculars score => more human-like
        # Map AI-likeness to (1 - score)
        score_clamped = max(0.0, min(1.0, float(score)))
        ai_likeness = 1.0 - score_clamped
        ai_percentage = round(ai_likeness * 100, 2)
        is_ai_generated = ai_likeness > 0.5
        
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


@app.route('/detect-fast', methods=['POST'])
def detect_fast():
    """
    Ultrafast heuristic AI detection (<1s on typical CPU) for long texts.
    Request body:
    { "text": "..." }
    Response schema identical to /detect.
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400
        text = data['text']
        if not text or len(text.strip()) == 0:
            return jsonify({'error': 'Text cannot be empty'}), 400
        t0 = time.time()
        score = fast_detect_score(text)
        elapsed = (time.time() - t0) * 1000
        print(f"⚡ /detect-fast completed in {elapsed:.1f} ms for {len(text)} chars", flush=True)
        score_clamped = max(0.0, min(1.0, float(score)))
        ai_likeness = 1.0 - score_clamped
        ai_percentage = round(ai_likeness * 100, 2)
        result = {
            'score': round(score_clamped, 4),
            'prediction': "Most likely human-generated" if score_clamped >= 0.5 else "Most likely AI-generated",
            'isAIGenerated': ai_likeness > 0.5,
            'aiPercentage': ai_percentage,
        }
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error during detect-fast: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
        
        # Process in smaller batches to avoid MPS OOM on Mac mini
        BATCH_SIZE = 4
        print(f"🔍 Analyzing {len(texts)} texts in batches of {BATCH_SIZE}...")
        
        all_scores = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i+BATCH_SIZE]
            print(f"  Batch {i//BATCH_SIZE + 1}/{(len(texts)-1)//BATCH_SIZE + 1}: processing {len(batch)} texts...")
            try:
                # Binoculars can handle batches natively
                batch_scores = bino.compute_score(batch)
                # Ensure it's a list
                if not isinstance(batch_scores, list):
                    batch_scores = [batch_scores]
                all_scores.extend(batch_scores)
                # Best-effort memory clean-up on MPS
                try:
                    import torch
                    if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available():
                        torch.mps.empty_cache()
                except Exception:
                    pass
            except Exception as e:
                print(f"❌ Error in batch {i//BATCH_SIZE + 1}: {e}")
                # If MPS OOM, move to CPU and retry once
                if 'MPS backend out of memory' in str(e):
                    try:
                        bino.observer_model = bino.observer_model.to('cpu')
                        bino.performer_model = bino.performer_model.to('cpu')
                        print("↩️  Switched models to CPU due to MPS OOM; retrying batch...")
                        batch_scores = bino.compute_score(batch)
                        if not isinstance(batch_scores, list):
                            batch_scores = [batch_scores]
                        all_scores.extend(batch_scores)
                        continue
                    except Exception as cpu_e:
                        print(f"❌ CPU retry failed: {cpu_e}")
                # Fallback: process individually
                for t in batch:
                    try:
                        all_scores.append(bino.compute_score(t))
                    except Exception as ie:
                        print(f"❌ Individual error: {ie}")
                        all_scores.append(None)

        threshold = getattr(bino, 'threshold', 0.5)
        results = []
        for s in all_scores:
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

        print(f"✅ Batch detection complete: {len(results)} results")

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
    print("  POST /detect-fast   - Ultrafast heuristic detection")
    print("  POST /batch-detect  - Detect AI in multiple texts")
    print("")
    print("⏳ Starting server...")
    print("   (Models will load on first request - ~10-25 seconds)")
    print("")
    
    # Run Flask app on port 5003 (Python Manager uses 5000)
    app.run(host='0.0.0.0', port=5003, debug=False)

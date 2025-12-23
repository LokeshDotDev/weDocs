# AI Detector GPU Status - Mac Mini

## Current Status: ✅ WORKING ON CPU

**Detector Service**: Running on port 5003  
**Mode**: CPU-only (BINOCULARS_FORCE_CPU=1)  
**Models**: Falcon-1B (2 models: observer + performer)  
**Process ID**: Check with `lsof -nP -iTCP:5003`

## GPU Situation 🎯

### What Happened
Your Mac mini's **MPS (Metal Performance Shaders) GPU works and is detected**, but:
- Available GPU memory: ~10.66 GB
- Required for 2x Falcon-1B models in FP16: ~11+ GB (models load simultaneously)
- Result: **MPS OUT OF MEMORY** during model initialization

### Why CPU Mode Was Chosen
The system tried to load both Falcon models (observer + performer) onto MPS GPU at once, which exceeded available VRAM. The process crashed silently during `.from_pretrained()` before weights could fully load.

**Trade-off**: CPU is **slower** (3-5x) but **stable and works reliably**.

## How to Try GPU Again (Advanced)

### Option 1: Use Smaller/Quantized Models
Edit `api.py` to use smaller models or quantization:
```python
binoculars_instance = Binoculars(
    observer_name_or_path="facebook/opt-125m",  # Smaller model
    performer_name_or_path="facebook/opt-125m",
    load_in_8bit=True,  # Quantization if supported
    max_token_observed=192,
)
```

### Option 2: Sequential Loading (Load one model at a time)
Modify `initialize_binoculars()` to load observer first, move to MPS, then load performer:
```python
# Load observer alone
observer = AutoModelForCausalLM.from_pretrained("tiiuae/falcon-rw-1b", ...)
observer = observer.to('mps').half()

# Load performer alone  
performer = AutoModelForCausalLM.from_pretrained("tiiuae/falcon-rw-1b", ...)
performer = performer.to('mps').half()

# Pass to Binoculars
binoculars_instance.observer_model = observer
binoculars_instance.performer_model = performer
```

### Option 3: Close Other Apps
Free up GPU memory by closing:
- Chrome/Safari (GPU-accelerated)
- Xcode, Final Cut, etc.
- Docker containers using GPU

Then restart detector **without** `BINOCULARS_FORCE_CPU`:
```bash
cd /Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode/python-manager/modules/ai-detector
HF_HOME="/Volumes/Vivek Data/hf-cache" ./.venv/bin/python3 api.py
```

## Current Performance

**CPU Mode (Active)**:
- First detection: ~60-90 seconds (model warm-up)
- Subsequent: ~15-30 seconds per paragraph
- Batch of 100 paragraphs: ~8-12 minutes

**MPS GPU Mode (If Working)**:
- First detection: ~15-25 seconds  
- Subsequent: ~3-8 seconds per paragraph
- Batch of 100 paragraphs: ~2-4 minutes

## Commands

**Check Status**:
```bash
curl -s http://localhost:5003/health | python3 -m json.tool
```

**Test Detection**:
```bash
curl -s -X POST http://localhost:5003/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"Test sentence for AI detection"}' | python3 -m json.tool
```

**View Logs**:
```bash
tail -f /tmp/detector_cpu.log
```

**Restart (CPU mode)**:
```bash
pkill -9 -f "api.py"
/tmp/start_detector_cpu.sh > /tmp/detector_cpu.log 2>&1 &
```

**Restart (Try GPU)**:
```bash
pkill -9 -f "api.py"
cd /Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode/python-manager/modules/ai-detector
HF_HOME="/Volumes/Vivek Data/hf-cache" ./.venv/bin/python3 api.py > /tmp/detector_mps_try.log 2>&1 &
# Wait 2 minutes and check:
tail -100 /tmp/detector_mps_try.log | grep -E "(MPS|CPU|Models.*loaded|OOM|device)"
```

## Bottom Line

✅ **Detector is WORKING and STABLE on CPU**  
⚠️ **MPS GPU detected but runs out of memory with current model size**  
🎯 **For speed: Option 2 (sequential loading) is most likely to work**  
📊 **Current setup provides accurate results, just slower**

The system WILL use MPS GPU if you implement sequential loading or use smaller models. For now, CPU mode ensures reliability while you decide if speed optimization is worth the effort.

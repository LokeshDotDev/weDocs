#!/bin/bash
# AI Detector startup script with smaller models to avoid segfaults

cd "$(dirname "$0")"

echo "🚀 Starting AI Detector on port 5002..."
echo "⚙️  Using smaller Falcon models (rw-1b) to avoid memory issues"
echo ""

# Use smaller models to avoid OOM/segfaults on CPU
export BINOCULARS_SMALL_MODELS=1
export HF_HOME=D:/huggingface_cache
export HF_OFFLOAD_FOLDER=D:/huggingface_cache/offload

# Activate venv if it exists
if [ -d ".venv" ]; then
    source .venv/Scripts/activate || . .venv/Scripts/activate
fi

# Install dependencies if not present
python -c "import flask" 2>/dev/null || {
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
}

# Run the API (not main.py which is for testing)
python -c "
from api import app, initialize_binoculars
initialize_binoculars()
app.run(host='0.0.0.0', port=5002, debug=False)
"

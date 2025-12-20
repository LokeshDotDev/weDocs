#!/bin/bash
# Humanizer API startup script (Streamlit-free)

cd "$(dirname "$0")"

echo "🚀 Starting Humanizer API on port 8000..."
echo "📦 Using minimal dependencies (no Streamlit)"
echo ""

# Activate venv if it exists
if [ -d ".venv" ]; then
    source .venv/Scripts/activate || . .venv/Scripts/activate
fi

# Install minimal API dependencies
python -c "import fastapi" 2>/dev/null || {
    echo "📦 Installing API dependencies..."
    pip install -r requirements-api.txt
}

# Download spaCy model if not present
python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || {
    echo "📥 Downloading spaCy model..."
    python -m spacy download en_core_web_sm
}

echo "✅ Starting FastAPI server..."
# Run the FastAPI service
python -c "
import uvicorn
from api.humanize_api import app
uvicorn.run(app, host='0.0.0.0', port=8000)
"

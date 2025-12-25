#!/bin/bash
# Humanizer Server Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Humanizer Server..."
echo ""

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source .venv/bin/activate || . .venv/bin/activate

# Install dependencies
if [ -f "requirements-api.txt" ]; then
    echo "📦 Installing API dependencies..."
    pip install -q --upgrade pip
    pip install -q -r requirements-api.txt
else
    echo "⚠️  requirements-api.txt not found. Installing from requirements.txt..."
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
fi

# Download spaCy model if not present
echo "📥 Checking spaCy model..."
python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || {
    echo "📥 Downloading spaCy model (this may take a while)..."
    python -m spacy download en_core_web_sm
}

# Download NLTK data if needed
echo "📥 Checking NLTK data..."
python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True)" 2>/dev/null || {
    echo "📥 Downloading NLTK data..."
    python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
}

# Set port
PORT=${HUMANIZER_PORT:-8000}
HOST=${HUMANIZER_HOST:-0.0.0.0}

echo ""
echo "✅ Starting Humanizer Server on $HOST:$PORT..."
echo "📍 Health check: http://localhost:$PORT/health"
echo "📍 API docs: http://localhost:$PORT/docs"
echo ""

# Run the server
export HUMANIZER_MODE=api
python main.py


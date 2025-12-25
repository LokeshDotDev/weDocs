#!/bin/bash
# Reductor Server Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Reductor Server..."
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
if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found. Creating it..."
    cat > requirements.txt << EOF
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.0.0
lxml>=5.0.0
EOF
fi

echo "📦 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if reductor-module exists
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MVP_ROOT="$ROOT_DIR/reductor-module/doc-anonymizer-mvp"
MVP_BACKEND="$MVP_ROOT/backend"

if [ ! -d "$MVP_BACKEND" ]; then
    echo "❌ Error: Reductor backend not found at: $MVP_BACKEND"
    echo "   Please ensure reductor-module/doc-anonymizer-mvp/backend exists"
    exit 1
fi

# Install backend dependencies
if [ -f "$MVP_ROOT/requirements.txt" ]; then
    echo "📦 Installing backend dependencies..."
    pip install -q -r "$MVP_ROOT/requirements.txt"
fi

# Set port
PORT=${PORT:-5017}

echo ""
echo "✅ Starting Reductor Server on port $PORT..."
echo "📍 Health check: http://localhost:$PORT/health"
echo ""

# Run the server
python main.py


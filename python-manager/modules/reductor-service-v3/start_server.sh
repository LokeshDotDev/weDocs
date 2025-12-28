#!/bin/bash
# Reductor Service v3 - Startup Script
# This script starts the Reductor Service v3 (Student NAME and ROLL NUMBER redaction)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Reductor Service v3..."
echo "📝 Purpose: Student NAME and ROLL NUMBER Redaction (Screenshot 2 Format)"
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
echo "📦 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Set default port if not provided
PORT=${PORT:-5018}
HOST=${HOST:-0.0.0.0}

echo ""
echo "✅ Environment ready!"
echo ""
echo "🌐 Starting FastAPI server..."
echo "📍 Host: $HOST"
echo "🔌 Port: $PORT"
echo "📖 API Documentation: http://localhost:$PORT/docs"
echo ""

# Start the server
export PORT=$PORT
export HOST=$HOST
python main.py

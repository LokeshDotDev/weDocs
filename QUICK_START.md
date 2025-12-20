# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Python 3.9+ with venv
- Docker (for MinIO)
- Git Bash or WSL (Windows)

---

## 🚀 Start All Services (Copy-Paste Commands)

### Terminal 1: Python Manager

```bash
pushd "D:/Codes/work/weDocs/python-manager"
# If venv doesn't exist, create it:
# python -m venv venv
# venv/Scripts/pip install -r requirements.txt
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### Terminal 2: AI Detector Module

```bash
pushd "D:/Codes/work/weDocs/ai-detector-and-humanizer/ai-detector"
# Ensure HuggingFace cache at D:/huggingface_cache
export HF_HOME="D:/huggingface_cache"
export TRANSFORMERS_CACHE="D:/huggingface_cache"
export BINOCULARS_SMALL_MODELS=1
venv/Scripts/python.exe api.py
# Runs on http://localhost:5002
```

### Terminal 3: Humanizer Module

```bash
pushd "D:/Codes/work/weDocs/ai-detector-and-humanizer/humanizer"
venv/Scripts/python.exe -m uvicorn api.humanize_api:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 4: Backend Server

```bash
pushd "D:/Codes/work/weDocs/server"
npm run dev
# Runs on http://localhost:4000
```

### Terminal 5: Frontend

```bash
pushd "D:/Codes/work/weDocs/frontend"
BACKEND_URL=http://localhost:4000 npm run dev -- -p 3001
# Runs on http://localhost:3001
```

---

## ✅ Verify Everything is Running

```bash
# Test all health endpoints
curl http://localhost:5000/health  # Python Manager
curl http://localhost:5002/health  # AI Detector
curl http://localhost:8000/health  # Humanizer
curl http://localhost:4000/api/health  # Backend

# Open frontend
open http://localhost:3001
```

Expected outputs:

- Python Manager: `{"status":"ok","version":"0.1.0","services":{...}}`
- AI Detector: `{"status":"initialized"}` or `{"status":"initializing"}`
- Humanizer: `{"status":"ok"}`
- Backend: `{"success":true,"data":{"status":"healthy",...}}`

---

## 🎯 Test the Complete Flow

### 1. AI Detection

1. **Upload a DOCX to MinIO** (use existing test file or upload via TUS)
2. **Open Frontend**: http://localhost:3001/ai-detector
3. **Select File**: Check the box next to your DOCX
4. **Click "Start AI Detection"**
5. **Watch Progress**: Status polls every 2 seconds
6. **View Results**: Color-coded paragraphs (red=AI, green=Human)

### 2. Humanization

1. **From AI Detector**: Click "Send to Humanizer" button
   OR
2. **Direct**: http://localhost:3001/humanizer
3. **Select File**: Check the box
4. **Click "Start Humanization"**
5. **Monitor Progress**: Progress bar updates in real-time
6. **Download Result**: Click "Download Humanized Document"
7. **Verify Formatting**: Open in Word/LibreOffice - styles intact!

---

## 🐛 Common Issues

### "Cannot connect to Python Manager"

**Fix**: Ensure Python Manager is running on port 5000

```bash
curl http://localhost:5000/health
```

### "AI Detector not responding"

**Fix**: Check if model is loading (takes 30-60s first time)

```bash
# Watch logs in Terminal 2
# Should see: "Loading model" → "Model loaded"
```

### "Job stuck at 0%"

**Fix**: Check backend logs for errors

```bash
# In Terminal 4, look for:
# [runDocxHumanizer] failed
# or
# [humanizeFile] error
```

### "MinIO connection refused"

**Fix**: Start MinIO Docker container

```bash
docker ps | grep minio
# If not running:
docker-compose -f server/docker-compose.yml up -d minio
```

### "Frontend shows 404"

**Fix**: Restart backend on correct port

```bash
# Check server/.env has:
# PORT=4000
# CORS_ORIGIN=http://localhost:3001
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Backend
# Terminal 4 shows pino JSON logs

# Python Manager
# Terminal 1 shows FastAPI uvicorn logs

# AI Detector
# Terminal 2 shows Flask logs

# Humanizer
# Terminal 3 shows FastAPI logs
```

### Check Job Status

```bash
# AI Detection
curl http://localhost:4000/api/ai-detection/job/detect-1766146397

# Humanization
curl http://localhost:4000/api/humanizer/job/humanize-1766146398
```

---

## 🛑 Stop All Services

```bash
# Ctrl+C in each terminal (1-5)
# Or close all terminal windows
```

---

## 🔄 Reset & Clean Start

```bash
# Clear all temp files
rm -rf /tmp/ai-detect-*
rm -rf /tmp/humanize-*

# Restart MinIO (clears in-memory data)
docker-compose -f server/docker-compose.yml restart minio

# Clear job cache (restart backend)
# Ctrl+C in Terminal 4, then npm run dev
```

---

## 📝 Environment Variables

### Backend `.env`

```env
PORT=4000
CORS_ORIGIN=http://localhost:3001
PYTHON_MANAGER_URL=http://localhost:5000
DOCX_HUMANIZER_SCRIPT=D:/Codes/work/weDocs/ai-detector-and-humanizer/humanizer/docx_humanize_lxml.py
DOCX_HUMANIZER_PYTHON=D:/Codes/work/weDocs/ai-detector-and-humanizer/humanizer/venv/Scripts/python.exe
DOCX_HUMANIZER_SKIP_DETECT=1
```

### Python Manager `.env`

```env
PORT=5000
DEBUG=false
CONVERTER_MODULE_URL=http://localhost:5001
AI_DETECTOR_MODULE_URL=http://localhost:5002
HUMANIZER_MODULE_URL=http://localhost:8000
```

### Frontend `.env`

```env
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

---

## 🎉 Success Checklist

- [ ] Python Manager health returns `{"status":"ok"}`
- [ ] AI Detector health returns `{"status":"initialized"}`
- [ ] Humanizer health returns `{"status":"ok"}`
- [ ] Backend health returns `{"success":true}`
- [ ] Frontend loads at http://localhost:3001
- [ ] AI Detection page shows file list
- [ ] Humanizer page shows file list
- [ ] AI Detection job completes successfully
- [ ] Humanization job completes successfully
- [ ] Downloaded DOCX preserves formatting
- [ ] ETag 304 responses in Network tab (during polling)

---

## Need Help?

1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed flow
2. Check [SYSTEM_FLOW.md](./SYSTEM_FLOW.md) for component overview
3. Review logs in each terminal window
4. Ensure all ports are correct (5000, 5002, 8000, 4000, 3001)
5. Verify no other services are using these ports

Happy coding! 🚀

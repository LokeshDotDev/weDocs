# System Flow Summary

## ✅ Implementation Complete!

All components are now wired to use the **Python Manager** as the central orchestration layer.

---

## Current Architecture

```
Frontend (Next.js :3001)
    ↓ /api/*
Backend (Express :4000)
    ↓ HTTP
Python Manager (FastAPI :5000)
    ├→ AI Detector Module (:5002)
    ├→ Humanizer Module (:8000)
    └→ Converter Module (:5001)
```

---

## Step-by-Step Flow

### 1. AI Detection Flow

**User Action:** Select DOCX files → Click "Start AI Detection"

```
1. Frontend → Backend
   POST /api/ai-detection/detect-batch
   Body: { fileKeys: ["uploads/doc.docx"] }

2. Backend (aiDetectionService.ts)
   - Download DOCX from MinIO
   - Extract text with mammoth
   - Split into paragraphs

3. Backend → Python Manager
   POST http://localhost:5000/ai-detection/detect
   Body: { texts: ["para 1", "para 2", ...] }

4. Python Manager (main.py)
   - Routes to AI Detector Module
   POST http://localhost:5002/detect

5. AI Detector Module (Binoculars)
   - Load Falcon-RW-1B model
   - Process each text
   - Return scores: [0.756, 0.432, ...]

6. Python Manager → Backend
   Return: { results: [{ text, score, label }] }

7. Backend
   - Calculate summary stats
   - Store in job Map
   - Return jobId

8. Frontend
   - Poll /api/ai-detection/job/{jobId}
   - Display color-coded results
   - Show "Send to Humanizer" button
```

### 2. Humanization Flow

**User Action:** Select DOCX files → Click "Start Humanization"

```
1. Frontend → Backend
   POST /api/humanizer/humanize-batch
   Body: { fileKeys: ["uploads/doc.docx"] }

2. Backend (humanizerService.ts)
   - Create job ID
   - Start async processing
   - Return jobId immediately

3. Backend Async Worker
   For each file:
     a. Download DOCX from MinIO
     b. Extract text via lxml (preserves formatting!)
     c. For each paragraph:
        - Backend → Python Manager → AI Detector
          (if skipDetect=false)
        - Backend → Python Manager → Humanizer
          POST http://localhost:5000/humanizer/humanize
          Body: { text: "original", mode: "standard" }
        - Replace text in XML tree
     d. Rebuild DOCX (formatting intact)
     e. Upload to MinIO as <name>_humanized.docx
     f. Update job status

4. Frontend
   - Poll /api/humanizer/job/{jobId} every 2s
   - ETag caching (304 if unchanged)
   - Show download button when complete
```

---

## Why This Architecture?

### ✅ Modular & Scalable

- Each Python service is independent
- Python Manager can route to multiple instances
- Easy to add new services (OCR, translator, etc.)

### ✅ Single Entry Point

- Backend only talks to Python Manager
- No need to manage multiple service URLs
- Health monitoring centralized

### ✅ Format Preservation

- lxml manipulates DOCX XML directly
- All styles, fonts, images preserved
- Only `<w:t>` text nodes changed

### ✅ Performance

- ETag reduces polling bandwidth
- Async jobs (non-blocking)
- HuggingFace models cached
- Temp file auto-cleanup

---

## File Storage

### MinIO Structure

```
wedocs/
├── uploads/
│   └── user1/
│       └── document.docx
└── humanized/
    └── user1/
        └── document_humanized.docx
```

### In-Memory Job Storage

```typescript
jobs: Map<string, Job> {
  "detect-1766146397": { status, results, ... },
  "humanize-1766146398": { status, progress, ... }
}
```

---

## ETag Explanation

### What It Does

When frontend polls `/api/humanizer/job/xyz`, backend returns:

```
Response Headers:
  ETag: W/"a1-abc123"
  Content: { status: "processing", progress: 45 }
```

Next poll includes:

```
Request Headers:
  If-None-Match: W/"a1-abc123"
```

If job **unchanged**: `304 Not Modified` (empty body, saves bandwidth)  
If job **changed**: `200 OK` with new data + new ETag

### Why It Matters

- Reduces bandwidth by ~90% during polling
- Faster response (no re-serialization)
- Better UX (less network load)

---

## Running the System

### 1. Start Python Manager

```bash
cd python-manager
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 5000
```

### 2. Start AI Detector Module

```bash
cd ai-detector-and-humanizer/ai-detector
venv/Scripts/python.exe api.py
# Runs on http://localhost:5002
```

### 3. Start Humanizer Module

```bash
cd ai-detector-and-humanizer/humanizer
venv/Scripts/python.exe -m uvicorn api.humanize_api:app --host 0.0.0.0 --port 8000
```

### 4. Start Backend

```bash
cd server
npm run dev
# Runs on http://localhost:4000
```

### 5. Start Frontend

```bash
cd frontend
npm run dev -- -p 3001
# Runs on http://localhost:3001
```

---

## Health Check Endpoints

```bash
# Python Manager (checks all registered services)
curl http://localhost:5000/health

# AI Detector
curl http://localhost:5002/health

# Humanizer
curl http://localhost:8000/health

# Backend
curl http://localhost:4000/api/health

# Frontend
open http://localhost:3001
```

---

## Next Steps (Optional Enhancements)

1. **Database Storage**: Persist jobs to PostgreSQL
2. **User Authentication**: JWT tokens, user-scoped files
3. **Batch Optimization**: Process multiple files in parallel
4. **Model Upgrades**: Switch to GPT-4 for detection
5. **DOCX Preview**: Inline viewer with diff highlighting
6. **Export Annotations**: Download annotated DOCX with colors
7. **Service Discovery**: Add Consul for dynamic routing
8. **Load Balancing**: Multiple Python Manager instances

---

## Troubleshooting

### Job Stuck at "Processing"

- Check Python Manager logs: `python-manager/` terminal
- Verify AI Detector/Humanizer are running
- Check network: `curl http://localhost:5002/health`

### ETag 304 Forever

- Job not changing (expected if processing long file)
- Or job failed silently (check backend logs)

### DOCX Formatting Lost

- Shouldn't happen with lxml approach
- Check temp file cleanup isn't running too early
- Verify script has write permissions

### MinIO Connection Failed

- Ensure Docker MinIO container is running
- Check MINIO_ENDPOINT/PORT in .env
- Test: `curl http://localhost:9000/minio/health/live`

---

## Summary

**✅ All Python services now under Python Manager**  
**✅ Backend calls Python Manager (not direct services)**  
**✅ Frontend has complete AI Detection UI**  
**✅ Humanizer preserves exact DOCX formatting**  
**✅ ETag reduces polling bandwidth**  
**✅ Scalable, modular architecture ready for growth**

Read [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed flow diagrams and technical deep-dive.

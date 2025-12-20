# System Architecture - WeDocs AI Detection & Humanizer

## Overview

This document explains the complete flow of file processing, AI detection, and humanization in the WeDocs system.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│                     http://localhost:3001                        │
│  - AI Detection UI       - Humanizer UI       - File Manager    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP API Calls (/api/*)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express/TypeScript)                  │
│                     http://localhost:4000                        │
│  - File Management       - Job Orchestration                    │
│  - MinIO Integration     - API Routes                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP Proxy Requests
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PYTHON MANAGER (FastAPI)                        │
│                     http://localhost:5000                        │
│  - Service Registry      - Health Monitoring                    │
│  - Request Routing       - Module Orchestration                 │
└────┬────────────────────┬────────────────────────────────────────┘
     │                    │
     │                    │ Route to Modules
     ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ AI DETECTOR  │    │  HUMANIZER   │    │  CONVERTER   │
│   (Flask)    │    │  (FastAPI)   │    │  (FastAPI)   │
│   Port 5002  │    │   Port 5003  │    │   Port 5001  │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Complete Flow: AI Detection

### Step 1: User Selects File

**Frontend** → **Backend**

```
GET /api/files/docx-list
Response: { files: [{ key, name, size }] }
```

### Step 2: User Starts AI Detection

**Frontend** → **Backend** → **Python Manager** → **AI Detector Module**

```
Frontend:
  POST /api/ai-detection/detect-batch
  Body: { fileKeys: ["uploads/user1/doc.docx"] }

Backend (Express):
  1. Download DOCX from MinIO to temp directory
  2. Extract text from DOCX using lxml (reads word/document.xml)
  3. Split text into chunks (paragraphs/sentences)
  4. Forward to Python Manager:
     POST http://localhost:5000/ai-detection/detect
     Body: { texts: ["paragraph 1", "paragraph 2", ...] }

Python Manager:
  Route request to AI Detector module:
     POST http://localhost:5002/detect
     Body: { texts: [...] }

AI Detector Module (Binoculars):
  1. Load Falcon-RW-1B model (cached in D:/huggingface_cache)
  2. Process each text chunk through model
  3. Return scores: [0.756, 0.432, 0.891, ...]
  Response: { results: [{ text, score, label }] }

Python Manager → Backend:
  Return detection results

Backend:
  1. Create detection result object with timestamps
  2. Store results in database (optional)
  3. Optionally save annotated DOCX to MinIO
  Response: { jobId, results: [...] }

Frontend:
  Display results with color-coded UI:
  - Red: AI-generated (score > 0.7)
  - Yellow: Uncertain (0.4 - 0.7)
  - Green: Human-written (< 0.4)
```

---

## Complete Flow: Humanization

### Step 1: User Triggers Humanization

**Frontend** → **Backend** → **Python Manager** → **Humanizer Module**

```
Frontend:
  POST /api/humanizer/humanize-batch
  Body: { fileKeys: ["uploads/user1/doc.docx"], skipDetect: false }

Backend (Express):
  1. Create job ID: humanize-{timestamp}
  2. Start async processing
  3. Return immediately: { jobId, status: "processing" }

Backend Async Worker:
  For each file:
    1. Download DOCX from MinIO → /tmp/humanize-xxx/input.docx
    2. Extract text via lxml (preserving XML structure)
    3. For each paragraph/run:
       a. If NOT skipDetect:
          - Call Python Manager AI Detection
          - Skip humanization if score < threshold
       b. Call Python Manager Humanizer:
          POST http://localhost:5000/humanizer/humanize
          Body: { text: "original text", mode: "standard" }
       c. Replace text in XML tree (w:t nodes)
    4. Rebuild DOCX with new text (formatting preserved!)
    5. Upload to MinIO → <original>_humanized.docx
    6. Update job status & results

Python Manager:
  Route to Humanizer Module:
     POST http://localhost:5003/humanize
     Body: { text, mode }

Humanizer Module:
  1. Apply paraphrasing/rewriting algorithms
  2. Maintain semantic meaning
  3. Return humanized text
  Response: { humanized_text, metrics }

Frontend Polling:
  GET /api/humanizer/job/{jobId} every 2 seconds
  - Returns: { status, progress, results }
  - ETag header for caching (304 if unchanged)
  - When status="completed", show download button
```

---

## File Processing Details

### DOCX Structure

```
document.docx (ZIP archive)
├── word/
│   ├── document.xml          ← Main content
│   ├── header1.xml           ← Headers
│   ├── footer1.xml           ← Footers
│   └── ...
├── _rels/
└── [Content_Types].xml
```

### Text Extraction (Preserving Formatting)

```python
# Using lxml to preserve exact formatting
doc_xml = etree.fromstring(zip.read('word/document.xml'))

for text_node in doc_xml.xpath('//w:t', namespaces=NS):
    original = text_node.text

    # Detect AI
    score = detect_text(original)

    # Humanize if needed
    if score > threshold:
        humanized = humanize_text(original)
        text_node.text = humanized  # Replace in-place

# Save back to DOCX (all styles/fonts/formatting intact)
```

---

## Storage Architecture

### MinIO Bucket Structure

```
wedocs/
├── uploads/
│   ├── user1/
│   │   ├── document.docx
│   │   └── presentation.docx
│   └── user2/
│       └── report.docx
├── humanized/
│   ├── user1/
│   │   ├── document_humanized.docx
│   │   └── presentation_humanized.docx
└── detected/
    └── user1/
        └── document_detected.docx  (optional: annotated)
```

### Database Schema (Optional)

```typescript
DetectionJob {
  id: string              // detect-1766146397536
  userId: string
  fileKey: string
  status: "pending" | "processing" | "completed" | "failed"
  results: {
    text: string
    score: number
    label: "AI" | "Human" | "Uncertain"
  }[]
  createdAt: Date
  completedAt: Date
}

HumanizationJob {
  id: string              // humanize-1766146397536
  userId: string
  fileKeys: string[]
  status: "pending" | "processing" | "completed" | "failed"
  progress: number        // 0-100
  results: {
    fileKey: string
    outputFileKey: string
    changesApplied: number
    processingTime: number
  }[]
  createdAt: Date
  completedAt: Date
}
```

---

## ETag Explanation

### What is ETag?

ETag (Entity Tag) is an HTTP response header used for **web cache validation**.

### Why We Use It

```typescript
// Backend returns:
Response Headers:
  ETag: W/"a1-22Nrbx9sxTuTjo5QQa57c9zeLlU"
  Content: { status: "processing", progress: 45 }

// Frontend polls with:
Request Headers:
  If-None-Match: W/"a1-22Nrbx9sxTuTjo5QQa57c9zeLlU"

// If job unchanged:
Response: 304 Not Modified (no body, saves bandwidth)

// If job changed:
Response: 200 OK with new data + new ETag
```

### Benefits

- **Reduces bandwidth**: 304 responses have no body
- **Faster polling**: Server doesn't re-serialize unchanged data
- **Efficient**: Frontend updates UI only when job changes

---

## Performance Optimizations

### 1. Caching

- **HuggingFace Models**: Cached in `D:/huggingface_cache` (no re-download)
- **Job Status**: In-memory Map in backend (fast lookup)
- **HTTP Responses**: ETag-based caching

### 2. Streaming

- **Large Files**: Stream from MinIO (no full load into memory)
- **Downloads**: Stream DOCX directly to browser

### 3. Async Processing

- **Batch Jobs**: Process in background, return job ID immediately
- **Polling**: Frontend checks status every 2 seconds
- **Non-blocking**: Backend continues serving other requests

### 4. Resource Management

- **Temp Files**: Auto-cleanup after processing
- **Memory**: Low-memory model loading with offloading
- **Connections**: Connection pooling for MinIO

---

## Error Handling

### Backend Errors

```typescript
try {
	await runDocxHumanizer(input, output);
} catch (err) {
	logger.error({ err, fileKey }, "[humanizeFile] failed");
	job.status = "failed";
	job.error = err.message;
}
```

### Python Manager Errors

```python
try:
    response = requests.post(module_url, json=data, timeout=300)
except requests.ConnectionError:
    raise HTTPException(503, "Service unavailable")
```

### Frontend Errors

```tsx
catch (error) {
  console.error("Humanization failed:", error)
  setLoading(false)
  alert("Processing failed. Please try again.")
}
```

---

## Scalability Considerations

### Current (Single Server)

- Python Manager on port 5000
- All modules on localhost
- In-memory job storage

### Future (Distributed)

```
┌──────────────┐
│ Load Balancer│
└──────┬───────┘
       │
  ┌────┴────┬────────┬────────┐
  ▼         ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Python│ │Python│ │Python│ │Python│
│Mgr #1│ │Mgr #2│ │Mgr #3│ │Mgr #4│
└──────┘ └──────┘ └──────┘ └──────┘
  │         │        │        │
  └────┬────┴────────┴────────┘
       │
  ┌────▼──────────────────────┐
  │ Service Discovery (Consul)│
  │ Redis Job Queue           │
  │ Shared Storage (MinIO)    │
  └──────────────────────────┘
```

### Why Python Manager Helps Scalability

1. **Single Entry Point**: Backend talks to one service
2. **Dynamic Routing**: Manager can route to multiple instances
3. **Health Monitoring**: Auto-discover failed services
4. **Load Balancing**: Distribute requests across workers
5. **Version Management**: Roll out updates module-by-module

---

## Security Notes

### File Validation

```typescript
// Backend validates DOCX
if (!fileKey.endsWith(".docx")) {
	throw new Error("Only DOCX files supported");
}

// Check file size
const stat = await minioClient.statObject(bucket, key);
if (stat.size > 50 * 1024 * 1024) {
	// 50MB
	throw new Error("File too large");
}
```

### Sanitization

```python
# Python sanitizes extracted text
def sanitize_text(text: str) -> str:
    # Remove null bytes, control chars
    return re.sub(r'[\x00-\x1F\x7F]', '', text)
```

### Authentication (Future)

- JWT tokens for API calls
- User-scoped file access
- Rate limiting per user

---

## Summary

**Flow in One Sentence:**  
Frontend → Backend (downloads DOCX, extracts text) → Python Manager (routes to modules) → AI Detector/Humanizer (processes text) → Python Manager → Backend (rebuilds DOCX, uploads to MinIO) → Frontend (downloads result).

**Key Points:**

- ✅ Formatting preserved via lxml XML manipulation
- ✅ All Python services under Python Manager (modular)
- ✅ ETag reduces polling bandwidth
- ✅ Async jobs for responsive UX
- ✅ Scalable architecture for future growth

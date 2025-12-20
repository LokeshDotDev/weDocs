# Testing Guide: AI Detection & Humanizer

## Prerequisites Checklist

Before testing, ensure you have:

- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed
- [ ] MinIO running with credentials configured
- [ ] PostgreSQL running (for backend)
- [ ] All `.env` files configured

---

## Step 1: Start All Services (5 Terminals)

### Terminal 1: Python Manager

```bash
cd d:/Codes/work/weDocs/python-manager
python main.py
```

**Expected output:**

```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:5000
```

---

### Terminal 2: AI Detector Module

```bash
cd d:/Codes/work/weDocs/python-manager/modules/ai-detector
python main.py
```

**Expected output:**

```
Downloading Binoculars models... (first time only)
INFO:     Uvicorn running on http://0.0.0.0:5002
```

**Note:** First run downloads ~2GB of models (takes 5-10 minutes)

---

### Terminal 3: Humanizer Module

```bash
cd d:/Codes/work/weDocs/python-manager/modules/humanizer
python main.py
```

**Expected output:**

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

### Terminal 4: Backend Server

```bash
cd d:/Codes/work/weDocs/server
npm run dev
```

**Expected output:**

```
Server running on http://localhost:4000
Database connected
MinIO connected
```

---

### Terminal 5: Frontend

```bash
cd d:/Codes/work/weDocs/frontend
npm run dev
```

**Expected output:**

```
▲ Next.js 15.x
- Local:        http://localhost:3001
```

---

## Step 2: Verify All Services Are Running

Open these URLs in your browser (all should return `200 OK`):

```bash
# Python Manager
curl http://localhost:5000/health

# AI Detector
curl http://localhost:5002/health

# Humanizer
curl http://localhost:8000/health

# Backend
curl http://localhost:4000/health

# Frontend
# Just open: http://localhost:3001
```

**All should respond with:** `{"status": "healthy"}` or similar

---

## Testing AI Detection 🔍

### Prepare Test Files

Create 2 DOCX files for testing:

**1. `ai-written.docx`** (AI-generated text):

```
Artificial intelligence has revolutionized the modern technological landscape
through sophisticated algorithms and machine learning paradigms. The implementation
of neural networks facilitates unprecedented computational capabilities.
```

**2. `human-written.docx`** (Natural human text):

```
I love going to the park on weekends. Yesterday, I saw a cute dog playing
fetch with its owner. The weather was nice, so I stayed for a while and
read my book under a tree.
```

---

### Test via Frontend (Recommended)

1. **Open browser:** http://localhost:3001/ai-detector

2. **Upload files:**

   - Click "Upload Files" button
   - Select both `ai-written.docx` and `human-written.docx`
   - Wait for upload to complete (progress bar)

3. **Run detection:**

   - Click "Analyze for AI Content" button
   - Wait 10-30 seconds per file

4. **Check results:**
   - `ai-written.docx` should show: **"AI Generated"** (red badge)
   - `human-written.docx` should show: **"Human Written"** (green badge)
   - View detailed scores for each paragraph

---

### Test via API (Advanced)

```bash
# 1. Upload a DOCX file
curl -X POST http://localhost:4000/api/upload \
  -F "file=@ai-written.docx" \
  -F "userId=test-user-123"

# Response: {"fileKey": "uploads/test-user-123/ai-written.docx"}

# 2. Run AI detection
curl -X POST http://localhost:4000/api/ai-detection/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "fileKey": "uploads/test-user-123/ai-written.docx",
    "userId": "test-user-123"
  }'

# Response:
{
  "fileKey": "uploads/test-user-123/ai-written.docx",
  "fileName": "ai-written.docx",
  "overallLabel": "AI",
  "overallScore": 0.89,
  "paragraphs": [
    {
      "text": "Artificial intelligence has...",
      "score": 0.89,
      "label": "AI",
      "index": 0
    }
  ]
}
```

---

## Testing Humanizer ✍️

### Prepare Test File

Create `test-document.docx` with formatted content:

```
Meeting Notes - December 2024

Attendees:
- John Smith (Manager)
- Sarah Johnson (Developer)
- Mike Chen (Designer)

Discussion Points:
1. Project timeline review
2. Budget allocation
3. Team assignments

Action Items:
→ Complete design mockups by Friday
→ Schedule follow-up meeting
→ Review Q4 performance metrics
```

**Make sure to include:**

- Headings (bold)
- Lists (bullets/numbers)
- Text formatting (bold, italic)
- Multiple paragraphs

---

### Test via Frontend (Recommended)

1. **Open browser:** http://localhost:3001/humanizer

2. **Upload files:**

   - Click "Upload Files" button
   - Select `test-document.docx` (or multiple files)
   - Wait for upload to complete

3. **Start humanization:**

   - Click "Start Humanization" button
   - Watch progress bar update in real-time
   - Wait 30-60 seconds per file

4. **Download results:**

   - When complete, click "Download" button
   - File saved as `test-document_humanized.docx`
   - Open in Word/LibreOffice to verify formatting preserved

5. **Verify changes:**
   - All formatting should be intact (bold, lists, etc.)
   - Text should be rephrased naturally
   - Structure should remain the same

---

### Test Batch Processing (20 Files)

To test parallel processing:

1. **Create 20 test files:**

   - Copy `test-document.docx` 20 times
   - Rename: `doc1.docx`, `doc2.docx`, ..., `doc20.docx`

2. **Upload all 20 files:**

   - Select all files in upload dialog
   - Wait for all uploads to complete

3. **Start humanization:**

   - Click "Start Humanization"
   - Monitor backend terminal for batch logs:
     ```
     [batchHumanize] started fileCount=20
     [batchHumanize] processing batch batchSize=3 batchStart=0
     [humanizeFile] success fileKey="doc1.docx" durationMs=30000
     [humanizeFile] success fileKey="doc2.docx" durationMs=32000
     [humanizeFile] success fileKey="doc3.docx" durationMs=29000
     [batchHumanize] processing batch batchSize=3 batchStart=3
     ...
     ```

4. **Verify performance:**
   - Should complete in ~3-4 minutes (not 10 minutes!)
   - Progress bar updates smoothly (~15% increments per batch)
   - All 20 files available for download

---

### Test via API (Advanced)

```bash
# 1. Upload a DOCX file
curl -X POST http://localhost:4000/api/upload \
  -F "file=@test-document.docx" \
  -F "userId=test-user-456"

# Response: {"fileKey": "uploads/test-user-456/test-document.docx"}

# 2. Start humanization job
curl -X POST http://localhost:4000/api/humanizer/batch \
  -H "Content-Type: application/json" \
  -d '{
    "fileKeys": ["uploads/test-user-456/test-document.docx"],
    "userId": "test-user-456"
  }'

# Response: {"jobId": "batch-1734567890123"}

# 3. Check job status (poll every 2 seconds)
curl http://localhost:4000/api/humanizer/job/batch-1734567890123

# Response (in progress):
{
  "status": "processing",
  "job": {
    "status": "processing",
    "progress": 0,
    "total": 1,
    "results": []
  }
}

# Response (completed):
{
  "status": "completed",
  "job": {
    "status": "completed",
    "progress": 1,
    "total": 1,
    "results": [
      {
        "fileKey": "uploads/test-user-456/test-document.docx",
        "fileName": "test-document.docx",
        "outputFileKey": "uploads/test-user-456/test-document_humanized.docx",
        "status": "success"
      }
    ]
  }
}

# 4. Download humanized file
curl http://localhost:4000/api/download/uploads/test-user-456/test-document_humanized.docx \
  -o test-document_humanized.docx
```

---

## Troubleshooting

### AI Detection Issues

**Problem:** "Service unavailable" error

**Solution:**

```bash
# Check AI Detector is running
curl http://localhost:5002/health

# Check Python Manager can reach it
curl http://localhost:5000/health

# Restart AI Detector if needed
cd d:/Codes/work/weDocs/python-manager/modules/ai-detector
python main.py
```

---

**Problem:** "Models not found" error

**Solution:**

```bash
# Set Hugging Face cache directory
export HF_HOME=d:/Codes/work/weDocs/huggingface_cache

# Download models manually
cd d:/Codes/work/weDocs/python-manager/modules/ai-detector
python -c "from transformers import AutoTokenizer, AutoModelForCausalLM; \
  AutoTokenizer.from_pretrained('tiiuae/falcon-7b'); \
  AutoModelForCausalLM.from_pretrained('tiiuae/falcon-7b')"
```

---

### Humanizer Issues

**Problem:** Humanization fails with "Script not found"

**Solution:**

```bash
# Verify script exists
ls d:/Codes/work/weDocs/python-manager/modules/humanizer/docx_humanize_lxml.py

# Check backend .env has absolute path
cat d:/Codes/work/weDocs/server/.env | grep DOCX_HUMANIZER_SCRIPT
# Should show: DOCX_HUMANIZER_SCRIPT=D:/Codes/work/weDocs/python-manager/modules/humanizer/docx_humanize_lxml.py
```

---

**Problem:** Formatting lost in output

**Solution:**

- Humanizer uses `lxml` to preserve formatting
- Verify input file has standard DOCX structure
- Try recreating file in Word (some converters create non-standard XML)

---

**Problem:** Batch processing too slow

**Solution:**

```typescript
// Increase concurrency in server/src/services/humanizerService.ts
const concurrencyLimit = 5;  // Default is 3

// Restart backend
cd d:/Codes/work/weDocs/server
npm run dev
```

---

### Backend Connection Issues

**Problem:** Frontend can't reach backend

**Solution:**

```bash
# Verify backend is on port 4000
curl http://localhost:4000/health

# Check frontend .env
cat d:/Codes/work/weDocs/frontend/.env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:4000

# Restart frontend
cd d:/Codes/work/weDocs/frontend
npm run dev
```

---

## Expected Performance

### AI Detection

- **Single file (5MB):** 10-20 seconds
- **10 files:** 2-3 minutes
- **Memory usage:** ~500MB (models loaded)

### Humanizer

- **Single file (5MB):** 30-40 seconds
- **20 files (parallel):** 3-4 minutes
- **Memory usage:** ~150MB peak (3 files at once)

---

## Quick Reference

### Service URLs

```
Frontend:        http://localhost:3001
Backend:         http://localhost:4000
Python Manager:  http://localhost:5000
AI Detector:     http://localhost:5002
Humanizer:       http://localhost:8000
```

### Health Checks

```bash
curl http://localhost:5000/health  # Python Manager
curl http://localhost:5002/health  # AI Detector
curl http://localhost:8000/health  # Humanizer
curl http://localhost:4000/health  # Backend
```

### Logs

```bash
# Watch backend logs
cd d:/Codes/work/weDocs/server
npm run dev

# Watch Python Manager logs
cd d:/Codes/work/weDocs/python-manager
python main.py

# Watch humanizer logs
cd d:/Codes/work/weDocs/python-manager/modules/humanizer
python main.py
```

---

## Success Checklist

- [ ] All 5 services started without errors
- [ ] All health checks return 200 OK
- [ ] Frontend loads at http://localhost:3001
- [ ] AI detection correctly identifies AI vs human text
- [ ] Humanizer preserves formatting in output files
- [ ] Batch processing completes in ~3-4 minutes for 20 files
- [ ] No errors in backend/frontend logs

---

## Next Steps After Testing

1. **Monitor performance:** Watch backend logs during batch processing
2. **Tune concurrency:** Adjust `concurrencyLimit` based on your server specs
3. **Test error cases:** Try invalid files, large files (>50MB), corrupt DOCX
4. **Add persistence:** Store jobs in PostgreSQL for history
5. **Production setup:** Add rate limiting, authentication, monitoring

---

**Ready to test?** Start with Terminal 1 (Python Manager) and work your way down!

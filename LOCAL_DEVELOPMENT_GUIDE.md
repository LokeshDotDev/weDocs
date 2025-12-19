# Local Development Guide - Binoculars & Humanizer

## Setup Complete! ✅

You now have a fully working **local development environment** for AI Detection and Text Humanization.

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Your Computer (Local Machine)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Node.js/TypeScript Backend (Port 3000)     │   │
│  │  - Express server                           │   │
│  │  - Routes: /api/ai-detection/*              │   │
│  │  - Routes: /api/humanizer/*                 │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │ HTTP calls                       │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Python Flask API (Port 5000)               │   │
│  │  - Binoculars AI Detection                  │   │
│  │  - Models: Falcon-7B (15GB)                 │   │
│  │  - Endpoint: POST /detect                   │   │
│  │  - Endpoint: POST /batch-detect             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Python Humanizer API (Port 5001)           │   │
│  │  - Text humanization                        │   │
│  │  - LLM integration                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Starting the Services

### 1. Start Binoculars API Server

**Terminal 1: Binoculars Detection API**

```bash
cd d:\Codes\work\weDocs\ai-detector-and-humanizer\ai-detector
python api.py
```

Expected output:

```
============================================================
🚀 Starting Binoculars AI Detection API
============================================================

📍 API will be available at: http://localhost:5000

Available endpoints:
  GET  /health        - Health check
  POST /detect        - Detect AI in single text
  POST /batch-detect  - Detect AI in multiple texts

⏳ Starting server...
   (Models will load on first request - ~10-25 seconds)
```

**Note:** On first run, models will download (~15GB). Subsequent runs use the cached models.

---

### 2. Start Humanizer API Server

**Terminal 2: Text Humanizer API**

```bash
cd d:\Codes\work\weDocs\ai-detector-and-humanizer\humanizer
python main.py
```

---

### 3. Start Node.js Backend

**Terminal 3: Express Backend**

```bash
cd d:\Codes\work\weDocs\server
npm run dev
```

---

## Testing the APIs

### Test Binoculars Detection

**Using Python script:**

```bash
python d:\Codes\work\weDocs\test-api-simple.py
```

**Using curl (Windows PowerShell):**

```powershell
# Test with AI-generated text
$response = Invoke-WebRequest -Uri "http://localhost:5000/detect" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text":"Dr. Capy Cosmos, a capybara unlike any other, astounded the scientific community with his groundbreaking research in astrophysics."}'

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Using curl (Git Bash/WSL):**

```bash
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Dr. Capy Cosmos, a capybara unlike any other, astounded the scientific community with his groundbreaking research in astrophysics."
  }'
```

**Expected Response:**

```json
{
	"text": "Dr. Capy Cosmos...",
	"score": 0.7566,
	"prediction": "Most likely AI-Generated",
	"confidence": 0.9766,
	"processing_time_ms": 1245
}
```

---

## API Endpoints

### Binoculars Detection API (Port 5000)

#### 1. Health Check

```
GET http://localhost:5000/health

Response:
{
  "status": "healthy",
  "service": "binoculars-detector",
  "initialized": true
}
```

#### 2. Single Text Detection

```
POST http://localhost:5000/detect
Content-Type: application/json

{
  "text": "Your text here..."
}

Response:
{
  "text": "Your text here...",
  "score": 0.7566,           // 0.0 = Human, 1.0 = AI
  "prediction": "Most likely AI-Generated",
  "confidence": 0.9766,
  "processing_time_ms": 1245
}
```

#### 3. Batch Detection

```
POST http://localhost:5000/batch-detect
Content-Type: application/json

{
  "texts": [
    "First text...",
    "Second text...",
    "Third text..."
  ]
}

Response:
{
  "results": [
    {
      "text": "First text...",
      "score": 0.7566,
      "prediction": "Most likely AI-Generated"
    },
    // ... more results
  ],
  "batch_processing_time_ms": 3500
}
```

---

## Performance Expectations

| Task                       | Time          | Notes                         |
| -------------------------- | ------------- | ----------------------------- |
| First request (model load) | 10-25 seconds | Downloads ~15GB, cached after |
| Single detection           | 1-2 seconds   | CPU inference                 |
| Batch (10 texts)           | 10-20 seconds | Parallel processing           |
| Health check               | <100ms        | No model required             |

---

## Model Information

**Models Used:**

- **Observer Model:** `tiiuae/falcon-7b` (7.5GB)
- **Performer Model:** `tiiuae/falcon-7b-instruct` (7.5GB)
- **Total Cache:** ~15GB

**Detection Method:**

- Perplexity-based analysis
- Zero-shot learning (no fine-tuning)
- Optimized for English text
- ~95% F1 score on diverse domains

---

## Troubleshooting

### Server won't start

```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000

# Kill the process if needed (Windows)
taskkill /PID <PID> /F
```

### Models won't download

- Check internet connection
- Ensure ~20GB free disk space
- Models cached in: `~/.cache/huggingface/hub/`

### Slow performance

- First run is slower (model download + compilation)
- Subsequent runs are much faster
- CPU inference is slower than GPU but stable

### API timeouts

- Increase timeout in requests to 120+ seconds for first request
- Once models are loaded, responses are 1-3 seconds

---

## Integration with Node.js Backend

The backend (`server/src/services/aiDetectionService.ts`) calls this Flask API:

```typescript
// Example: Backend calling Binoculars API
const response = await axios.post("http://localhost:5000/detect", {
	text: extractedText,
});

const { score, prediction } = response.data;
const aiPercentage = (score * 100).toFixed(2);
```

---

## Next Steps

1. ✅ **API Running Locally** - Binoculars is ready to use
2. ⏳ **Models Loading** - First request will take 10-25 seconds
3. 🧪 **Run Tests** - Execute `test-api-simple.py` to verify
4. 🔗 **Connect Backend** - Node.js backend can now call Flask API
5. 📤 **Upload Files** - Test with DOCX files through the backend

---

## References

- **Binoculars Paper:** https://arxiv.org/abs/2401.12070
- **Models on HuggingFace:** https://huggingface.co/tiiuae/falcon-7b
- **Falcon LLM:** https://falconllm.tii.ae/

---

**Happy detecting! 🔍**

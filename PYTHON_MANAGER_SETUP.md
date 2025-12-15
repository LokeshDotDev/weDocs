# Python Manager Integration Guide

## Architecture Overview

```
python-manager/
  ├─ modules/
  │   ├─ converter-module/    # PDF→DOCX→HTML service (port 5001)
  │   ├─ ai-detector/         # [future] (port 5002)
  │   └─ humanizer/           # [future] (port 5003)
  ├─ main.py                  # Router/wrapper (port 5000)
  ├─ config.py                # Service registry
  └─ requirements.txt
```

## Setup

### 1. Install Python Manager (Router)

```bash
cd python-manager
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Install Converter Module

```bash
cd python-manager/modules/converter-module
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install pandoc system dependency
# Ubuntu/Debian:
sudo apt-get install pandoc

# macOS:
brew install pandoc

# Windows: Use choco or download from https://pandoc.org/installing.html
```

### 3. Configure environment

Edit `python-manager/.env`:

```
PORT=5000
CONVERTER_MODULE_URL=http://localhost:5001
```

Edit `python-manager/modules/converter-module/.env`:

```
PORT=5001
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=wedocs
```

### 4. Start Services (separate terminals)

**Terminal 1: Start Converter Module**

```bash
cd python-manager/modules/converter-module
source venv/bin/activate
python main.py
# Runs on http://localhost:5001
```

**Terminal 2: Start Python Manager (Router)**

```bash
cd python-manager
source venv/bin/activate
python main.py
# Runs on http://localhost:5000
```

### 5. Node.js Server Configuration

In `server/.env`, add:

```
PYTHON_MANAGER_URL=http://localhost:5000
```

### 6. Install Node.js dependencies

```bash
cd server
npm install
npm run dev
```

## Architecture Flow

```
Frontend (Uppy)
    ↓
    uploads PDF
    ↓
Tus Server
    ↓
    streams to MinIO /raw/
    ↓
Node.js Server
    ↓
    POST /api/converter/pdf-to-html
    ↓
Python Manager (Router - port 5000)
    ↓
    forwards to converter module
    ↓
Converter Module (port 5001)
    ↓
    1. Download PDF from MinIO
    2. Convert PDF → DOCX (pdf2docx)
    3. Upload DOCX to MinIO /converted/
    4. Convert DOCX → HTML (pandoc)
    5. Upload HTML to MinIO /formatted/
    ↓
Returns paths → Python Manager → Node.js
```

## API Usage

### Convert PDF to HTML

**Request:**

```bash
curl -X POST http://localhost:3000/api/converter/pdf-to-html \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "u_123",
    "upload_id": "up_789",
    "filename": "assignment.pdf",
    "relative_path": "Rahul_104/assignment.pdf"
  }'
```

**Response:**

```json
{
	"status": "success",
	"user_id": "u_123",
	"upload_id": "up_789",
	"filename": "assignment.pdf",
	"raw_path": "users/u_123/uploads/up_789/raw/Rahul_104/assignment.pdf",
	"converted_path": "users/u_123/uploads/up_789/converted/Rahul_104/assignment.docx",
	"formatted_path": "users/u_123/uploads/up_789/formatted/Rahul_104/assignment.html"
}
```

## MinIO Storage Structure

Files are organized by processing stage:

```
users/
  u_123/
    uploads/
      up_789/
        raw/
          Rahul_104/
            assignment.pdf          ← Original PDF
        converted/
          Rahul_104/
            assignment.docx         ← Intermediate DOCX
        formatted/
          Rahul_104/
            assignment.html         ← Final HTML
```

## Triggering Conversion from Upload Completion

To automatically convert after upload, the Tus server can emit an event when `POST_FINISH` fires. For now, you can manually call the converter API or integrate with RabbitMQ (future).

Example: Add this to `tus-server/src/index.ts` later:

```typescript
app.post("/api/converter/pdf-to-html", async (req, res) => {
	// Call Python Manager
	const result = await axios.post(
		"http://localhost:5000/convert/pdf-to-html",
		req.body
	);
	res.json(result.data);
});
```

## Scaling for 18,000+ Files

### Phase 1 (Current)

- Direct API calls from Node.js
- Sequential processing
- Works for < 100 files/day

### Phase 2 (Next)

- Add RabbitMQ queue
- Worker pool (4-8 Python workers)
- Async job processing
- Batch database writes

### Phase 3 (Future)

- Horizontal scaling
- Multiple Python Manager instances
- Load balancer
- Redis caching

## Troubleshooting

**pandoc not found:**

```bash
# Install pandoc system-wide
sudo apt-get install pandoc
which pandoc  # Should show /usr/bin/pandoc
```

**MinIO connection refused:**

```bash
# Check MinIO is running
curl http://localhost:9000/minio/health/live

# Verify credentials in .env match your MinIO setup
```

**PDF conversion fails:**

- Check file is valid PDF
- Review Python Manager logs for pdf2docx errors
- Some PDFs (scanned images) won't convert; recommend OCR service later

**Slow conversions:**

- Large PDFs (>100MB) can take 5+ minutes
- Consider chunking/splitting for 18k scenario
- Pandoc is I/O bound; SSD storage helps

# DOCX Anonymization System (Reductor)

Complete system to remove student identity (name & roll number) from DOCX files while preserving layout exactly.

## Architecture

```
Frontend (Next.js)
  ↓ /api/reductor/files (list DOCX files from MinIO)
  ↓ /api/reductor/anonymize-file (process a file)
  ↓ /api/reductor/download (retrieve anonymized file)
Node Backend (Express)
  ↓ HTTP calls to python-manager
Python Manager (FastAPI)
  ↓ Routes to reductor service
Reductor Service (FastAPI)
  ↓ Calls doc-anonymizer backend
Doc-Anonymizer Backend (Python + lxml)
  ├─ utils/docx_utils.py - ZIP/XML handling
  ├─ identity/detector.py - Find name/roll number
  ├─ identity/confidence.py - Safety checks
  ├─ cleaner/name_remover.py - Remove name
  ├─ cleaner/rollno_remover.py - Remove roll number
  └─ batch/processor.py - Orchestrate pipeline
MinIO (S3-compatible)
  ├─ Original DOCX files
  └─ anonymized/ folder with processed files
```

## Setup & Run

### 1. Start Reductor Service (Python)

```bash
# Create venv and install deps
python3 -m venv python-manager/modules/reductor/.venv
python-manager/modules/reductor/.venv/bin/pip install fastapi uvicorn lxml

# Start service on port 5017
PORT=5017 python-manager/modules/reductor/.venv/bin/python \
  python-manager/modules/reductor/main.py
```

### 2. Start Python Manager (FastAPI Router)

```bash
# Restart to reload new reductor routes
PORT=5002 python-manager/.venv/bin/python python-manager/main.py
```

### 3. Start Node Backend (Express)

```bash
cd server
npm run dev
# Listens on http://localhost:3000
```

### 4. Start Frontend (Next.js)

```bash
cd frontend
npm run dev
# Listens on http://localhost:3001
# Rewrites /api/* to http://localhost:3000
```

### 5. Open in Browser

Navigate to: **http://localhost:3001/reductor**

You'll see:
- List of DOCX files from MinIO (automatically fetched)
- For each file:
  - File name, size, upload date
  - "Anonymize" button
  - Download links (original + anonymized) after processing

## How It Works

### User Flow

1. **Frontend loads** → Fetches list of DOCX files from MinIO via `/api/reductor/files`
2. **User clicks "Anonymize"** → Sends POST to `/api/reductor/anonymize-file` with `fileKey`
3. **Node backend**:
   - Downloads the DOCX from MinIO to `/tmp`
   - Calls Python Manager's `/reductor/anonymize-docx` endpoint
   - Uploads anonymized result back to MinIO under `anonymized/` folder
   - Returns download URL to frontend
4. **User downloads** → Clicks download link, file streams from MinIO via `/api/reductor/download`

### Backend Processing

When anonymizing a DOCX:

1. **Reduce Service** receives POST `/anonymize/docx`
2. **Batch Processor** (from doc-anonymizer):
   - Unzips DOCX → extracts `/tmp/extracted-*/word/document.xml`
   - **Detector** scans document for:
     - Student name (heuristic: "FirstName LastName" pattern)
     - Roll number (6-15 consecutive digits)
   - **Confidence** assessor decides if safe to remove (always yes for roll, only if confident for name)
   - **Removers** strip the text from XML nodes (`<w:t>` elements)
   - Saves modified XML back
   - Rezips DOCX exactly as original
3. **Output** → Anonymized DOCX with layout preserved

## Key Constraints (Per Design)

✅ **DO:**
- Modify only existing XML text nodes (`<w:t>`)
- Preserve all layout, formatting, spacing
- Use lxml + zipfile ONLY
- Make deterministic, safe decisions
- Return false negatives (don't remove) over false positives

❌ **DON'T:**
- Recreate or reflow paragraphs
- Normalize runs or styles
- Use python-docx for editing
- Guess when unsure
- Auto-correct layout

## API Endpoints

### Frontend → Node Backend

| Method | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| GET | `/api/reductor/files` | - | `{ files: [{name, key, size, lastModified}, ...] }` |
| POST | `/api/reductor/anonymize-file` | `{fileKey}` | `{status, original_file, anonymized_file, download_url}` |
| GET | `/api/reductor/download?fileKey=...` | - | (file stream) |

### Node Backend → Python Manager

| Method | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| POST | `/reductor/anonymize-docx` | `{input_file_path, output_file_path}` | `{status, ...}` |
| POST | `/reductor/anonymize-text` | `{text}` | `{anonymized_text, detected_name, detected_roll_no}` |

### Python Manager → Reductor Service

| Method | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| GET | `/health` | - | `{status, service}` |
| POST | `/anonymize/docx` | `{input_file_path, output_file_path}` | `{status, ...}` |
| POST | `/anonymize/text` | `{text}` | `{anonymized_text, detected_name, detected_roll_no}` |

## Testing

### CLI Tests

```bash
# Test file listing
curl -s http://localhost:3000/api/reductor/files | jq .

# Test anonymizing a specific file
curl -s -X POST http://localhost:3000/api/reductor/anonymize-file \
  -H 'Content-Type: application/json' \
  -d '{
    "fileKey": "users/u_123/uploads/6652b6dcf153a87a38b1540a4cc9d53b/formatted/OPERATION MANAGEMENT.docx"
  }' | jq .

# Download anonymized file
ANON_KEY="anonymized/1766391583383-users/u_123/uploads/6652b6dcf153a87a38b1540a4cc9d53b/formatted/OPERATION%20MANAGEMENT.docx"
curl -s "http://localhost:3000/api/reductor/download?fileKey=$ANON_KEY" -o /tmp/result.docx

# Compare original vs anonymized
python3 python-manager/scripts/test_anonymization.py /tmp/original.docx /tmp/result.docx
```

### Verify Anonymization

Before anonymizing:
```bash
unzip -p "users/u_123/uploads/.../OPERATION MANAGEMENT.docx" word/document.xml | \
  python3 -c "import sys; from lxml import etree; root = etree.fromstring(sys.stdin.read()); \
  ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}; \
  print(' '.join(t.text for t in root.xpath('//w:t', namespaces=ns) if t.text))" | head -c 300
```

After anonymizing:
```bash
unzip -p "anonymized/...docx" word/document.xml | \
  python3 -c "import sys; from lxml import etree; root = etree.fromstring(sys.stdin.read()); \
  ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}; \
  print(' '.join(t.text for t in root.xpath('//w:t', namespaces=ns) if t.text))" | head -c 300
```

You should see student name/roll number removed but all other text intact.

## File Locations

- **Frontend page**: [frontend/app/reductor/page.tsx](frontend/app/reductor/page.tsx)
- **Node backend**: [server/src/routes/reductorRoutes.ts](server/src/routes/reductorRoutes.ts)
- **Python manager routes**: [python-manager/main.py](python-manager/main.py) (lines ~72-107)
- **Manager config**: [python-manager/config.py](python-manager/config.py) (reductor service entry)
- **Reductor service**: [python-manager/modules/reductor/main.py](python-manager/modules/reductor/main.py)
- **Doc-anonymizer MVP**: [reductor-module/doc-anonymizer-mvp/backend/batch/processor.py](reductor-module/doc-anonymizer-mvp/backend/batch/processor.py)
- **Test script**: [python-manager/scripts/test_anonymization.py](python-manager/scripts/test_anonymization.py)

## Example Output

```
Reductor - DOCX Anonymizer

DOCX Files (7)

[File Card]
OPERATION MANAGEMENT.docx
Size: 47.4 KB • Modified: 12/22/2025

[Anonymize Button] ✅ Done

✅ Anonymization Complete
[Download Anonymized] [Download Original]
Output: anonymized/1766391583383-users/u_123/uploads/6652b6dcf153a87a38b1540a4cc9d53b/formatted/OPERATION MANAGEMENT.docx
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `curl: Failed to connect to localhost:3000` | Start Node backend: `cd server && npm run dev` |
| `curl: Failed to connect to localhost:5017` | Start Reductor service: `PORT=5017 python -m ... main.py` |
| Frontend shows "No DOCX files found" | Check MinIO has .docx files; ensure MINIO_BUCKET env var is set (default: `wedocs`) |
| Anonymization returns 503 | Verify python-manager is running on 5002; check `/tmp/python-manager.log` |
| File downloads as zero bytes | Check `/tmp` for leftover files; verify network streaming isn't interrupted |

## Performance

- **Small DOCX** (< 100 KB): ~500 ms (mostly MinIO network I/O)
- **Large DOCX** (500 KB+): ~1-2 seconds
- **Text anonymization**: ~10 ms
- **Batch processing**: Scales linearly; can add queue system later if needed

## Future Enhancements

- [ ] Batch anonymize multiple files at once
- [ ] Support other document types (PPTX, XLSX)
- [ ] Custom pattern matching for institution-specific data
- [ ] Audit log of anonymized files
- [ ] Undo/restore from audit trail
- [ ] Email notifications on completion
- [ ] API key authentication for external integrations

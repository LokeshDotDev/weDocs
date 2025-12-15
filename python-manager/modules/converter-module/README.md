# PDF to HTML Converter Module

Standalone FastAPI module for converting PDF → DOCX → HTML. Runs independently and is called by Python Manager.

## Quick start

```bash
cd converter-module
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install pandoc system dependency
# Ubuntu/Debian:
sudo apt-get install pandoc

# macOS:
brew install pandoc

python main.py
```

Server runs on `http://localhost:5001`.

## API

- `GET /health` - health check
- `POST /convert/pdf-to-html` - convert PDF to HTML

### Request example

```bash
curl -X POST http://localhost:5001/convert/pdf-to-html \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "u_123",
    "upload_id": "up_789",
    "filename": "assignment.pdf",
    "relative_path": "Rahul_104/assignment.pdf"
  }'
```

### Response

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

## Architecture

This is a **standalone service module**, not part of Python Manager. It:
- Receives conversion requests from Python Manager
- Downloads PDF from MinIO
- Converts PDF → DOCX → HTML
- Uploads results back to MinIO
- Returns status to caller

Future modules (AI detection, humanizer, etc.) follow the same pattern.

## Environment

Configure in `.env`:
```
PORT=5001                          # Must differ from other modules
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=uploads
```

# Reductor Service v2

Clean, production-ready document anonymizer.

## Features

- Downloads PDF from MinIO
- Converts PDF → DOCX (preserves structure)
- Detects student name and roll number intelligently
- Removes ONLY student identity (preserves all labels, formatting, alignment)
- Uploads anonymized DOCX back to MinIO
- Returns detailed before/after report

## Pipeline

1. **Download**: PDF from MinIO raw/ path
2. **Convert**: PDF → DOCX (pdf2docx)
3. **Detect**: Extract name and roll number from document start
4. **Remove**: Clear text nodes containing EXACT name/roll match
5. **Verify**: Confirm removal and measure what remains
6. **Upload**: Anonymized DOCX to MinIO formatted/ path

## Installation

```bash
pip install -r requirements.txt
```

## Running

```bash
python main.py
```

Default: localhost:5018 (FastAPI)

## API

### POST /health
Health check.

### POST /anonymize
Request:
```json
{
  "bucket": "wedocs",
  "object_key": "users/u_123/uploads/xxx/raw/FILENAME.pdf",
  "output_key": "users/u_123/uploads/xxx/formatted/FILENAME_anonymized.docx"
}
```

Response:
```json
{
  "status": "success",
  "anonymized_docx_path": "...",
  "minio_output_key": "...",
  "detected_before": {
    "name": "...",
    "roll_no": "...",
    "confidence": "HIGH|MEDIUM|LOW"
  },
  "detected_after": {
    "name": null,
    "roll_no": null,
    "confidence": "CLEAN"
  },
  "removed_bytes": 123
}
```

## Architecture

- `identity_detector.py`: Smart detection (detects only student identity, not labels)
- `docx_anonymizer.py`: Text-node-level removal (preserves structure 100%)
- `minio_utils.py`: MinIO download/upload
- `converter_utils.py`: PDF→DOCX via pdf2docx
- `main.py`: FastAPI entry point

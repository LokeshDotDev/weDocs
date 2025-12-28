# Reductor Service v3 - Configuration Guide

## Environment Variables

Create a `.env` file in the service directory to configure the service:

```bash
# Port to run the service on
PORT=5018

# Host to bind to (0.0.0.0 = all interfaces, 127.0.0.1 = localhost only)
HOST=0.0.0.0

# Logging level (debug, info, warning, error, critical)
LOG_LEVEL=info
```

## Patterns Configuration

### NAME Pattern (Customizable)

**Default Strict Pattern:**
```regex
NAME\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s+[A-Z][a-z]+)?)
```

**Matches:**
- NAME: SHANMUGAPRIYA SIVAKUMAR
- NAME: JOHN DOE
- NAME: MARY JANE WATSON

**Default Flexible Pattern:**
```regex
(?:NAME|NAME\s*:|name)\s*[:\s]?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)
```

### ROLL NUMBER Pattern (Customizable)

**Default Strict Pattern:**
```regex
ROLL\s*(?:NUMBER|NO\.?)\s*:\s*(\d{10,15})
```

**Matches:**
- ROLL NUMBER: 25145050010
- ROLL NO: 25145050010
- ROLL NO.: 25145050010

**Default Flexible Pattern:**
```regex
(?:ROLL\s*NUMBER|ROLL\s*NO|ROLL NO|ROLL|REGISTRATION)\s*[:\s]?\s*(\d{8,15})
```

## Advanced Configuration (In Code)

To customize patterns, edit `main.py` and modify the `StudentIdentifierExtractor` class:

```python
class StudentIdentifierExtractor:
    # Customize these patterns
    STRICT_NAME_PATTERN = re.compile(r"YOUR_CUSTOM_NAME_PATTERN")
    STRICT_ROLL_PATTERN = re.compile(r"YOUR_CUSTOM_ROLL_PATTERN")
    FLEX_NAME_PATTERN = re.compile(r"YOUR_CUSTOM_FLEX_NAME_PATTERN")
    FLEX_ROLL_PATTERN = re.compile(r"YOUR_CUSTOM_FLEX_ROLL_PATTERN")
```

## Service Endpoints Configuration

All endpoints are pre-configured in `main.py`:

- `GET /health` - Health check
- `GET /info` - Service information
- `POST /identify/text` - Extract identifiers
- `POST /redact/text` - Redact text
- `POST /redact/document` - Redact document file
- `POST /redact/batch` - Batch processing

## Docker Configuration (Optional)

To run in Docker, create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=5018
ENV HOST=0.0.0.0

CMD ["python", "main.py"]
```

Build and run:

```bash
docker build -t reductor-service-v3 .
docker run -p 5018:5018 reductor-service-v3
```

## Performance Tuning

### For High-Volume Processing

Adjust worker count in `main.py`:

```python
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        workers=4,  # Increase for parallel processing
        access_log=False  # Disable logging for speed
    )
```

### For Low Latency

```python
uvicorn.run(
    app,
    host="127.0.0.1",  # Use localhost only
    port=port,
    loop="uvloop",  # Faster event loop
    http="httptools"  # Faster HTTP parsing
)
```

## Security Configuration

### Authentication (Optional)

Add to `main.py` for API key authentication:

```python
from fastapi import Header, HTTPException

API_KEY = "your-secret-key"

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key

# Use in endpoints:
@app.post("/redact/text")
async def redact_text(request: RedactionRequest, api_key: str = Depends(verify_api_key)):
    # ... endpoint logic
```

### CORS Configuration

Add to `main.py` to allow specific origins:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Logging Configuration

### Basic Logging

The service uses Python's built-in logging. Output is printed to console.

### Advanced Logging

Add to `main.py`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('reductor-service-v3.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

## File Handling Configuration

### Output Directory Permissions

Ensure output directory is writable:

```bash
mkdir -p /path/to/output
chmod 755 /path/to/output
```

### Temporary File Location

Modify in code (if needed):

```python
import tempfile

# Change temp directory
temp_dir = tempfile.gettempdir()  # Default: /tmp on Unix, %TEMP% on Windows
```

## Database Configuration (Optional)

If you want to log redaction history:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# SQLite example
DATABASE_URL = "sqlite:///./redaction_history.db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Store redaction records
def log_redaction(input_file: str, output_file: str, name: str, roll_no: str):
    session = SessionLocal()
    # Add your database logic here
    session.close()
```

## Monitoring Configuration

### Health Check Frequency

Configure external monitoring to check health every 30 seconds:

```bash
while true; do
  curl -s http://localhost:5018/health > /dev/null
  sleep 30
done
```

### Error Alerts

Setup error notification (example with email):

```python
import smtplib

def send_error_alert(error_message: str):
    # Send email or notification
    pass

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    send_error_alert(str(exc))
    return {"error": str(exc)}
```

## Memory Configuration

### Limit Memory Usage (Linux)

```bash
# Limit to 512MB
systemd-run --scope -p MemoryLimit=512M ./start_server.sh
```

### Monitor Memory

```bash
top -p $(pgrep -f "python main.py")
```

## Integration Configuration

### With TUS Upload Server

Configure in your TUS server to redact uploads:

```javascript
// In TUS server event handler
const redactDocument = async (filePath) => {
  const response = await fetch('http://localhost:5018/redact/document', {
    method: 'POST',
    body: JSON.stringify({
      input_file_path: filePath,
      output_file_path: filePath.replace('.docx', '_redacted.docx'),
      file_format: 'docx'
    })
  });
  return response.json();
};
```

### With MinIO Integration

Configure to process documents stored in MinIO:

```python
import boto3

s3_client = boto3.client(
    's3',
    endpoint_url='http://localhost:9000',
    aws_access_key_id='minioadmin',
    aws_secret_access_key='minioadmin'
)

async def redact_from_minio(bucket: str, object_key: str):
    # Download from MinIO
    s3_client.download_file(bucket, object_key, '/tmp/input.docx')
    
    # Redact
    requests.post('http://localhost:5018/redact/document', ...)
    
    # Upload redacted version
    s3_client.upload_file('/tmp/output.docx', bucket, f'redacted_{object_key}')
```

## Testing Configuration

### Unit Tests

Create `test_main.py`:

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_extract_identifiers():
    response = client.post(
        "/identify/text",
        json={
            "text": "NAME: TEST USER\nROLL NUMBER: 12345678901"
        }
    )
    assert response.status_code == 200
    assert response.json()["detected_name"] == "TEST USER"
```

Run tests:

```bash
pip install pytest
pytest test_main.py -v
```

---

## Configuration Checklist

- [ ] Set `PORT` environment variable if needed
- [ ] Set `HOST` for network binding
- [ ] Ensure output directory exists and is writable
- [ ] Configure patterns if document format differs
- [ ] Setup logging if needed
- [ ] Add authentication if exposed to network
- [ ] Configure CORS for frontend integration
- [ ] Setup monitoring/health checks
- [ ] Test with sample documents
- [ ] Configure backup/logging for redaction records

---

For more information, see [README.md](README.md) or run `./start_server.sh` to start the service.

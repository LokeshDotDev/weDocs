# Python Manager - Document Processing Orchestrator

FastAPI-based orchestrator/router that coordinates multiple document processing service modules. Python Manager itself does **NOT** do any conversion; it just routes requests to registered services.

## Architecture

```
Node.js Server
    ↓
Python Manager (port 5000) - Router/Wrapper
    ↓
    ├─→ modules/converter-module (port 5001) - PDF→DOCX→HTML
    ├─→ modules/ai-detector (port 5002) - [future]
    └─→ modules/humanizer (port 5003+) - [future]
```

**Folder Structure:**

```
python-manager/
  ├─ modules/
  │   ├─ converter-module/    # PDF→DOCX→HTML service
  │   ├─ ai-detector/         # [future] AI detection service
  │   └─ humanizer/           # [future] Humanization service
  ├─ main.py                  # Router/wrapper (this runs on 5000)
  ├─ config.py                # Service registry
  └─ requirements.txt
```

Each module is **standalone** and can be built in any framework (FastAPI, Flask, Django, etc.).

## Quick start

**Start Python Manager (router):**

```bash
cd python-manager
cp .env.example .env
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

python main.py  # Runs on port 5000
```

**Start Converter Module (in separate terminal):**

```bash
cd python-manager/modules/converter-module
cp .env.example .env
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python main.py  # Runs on port 5001
```

Python Manager runs on `http://localhost:5000`, modules run on their configured ports.

## Configuration

Edit `.env`:

```
PORT=5000
CONVERTER_MODULE_URL=http://localhost:5001
# Future modules:
# AI_DETECTOR_MODULE_URL=http://localhost:5002
# HUMANIZER_MODULE_URL=http://localhost:5003
```

## API Endpoints

- `GET /health` - Manager health + all service statuses
- `POST /convert/pdf-to-html` - Route to converter module

### Example request

```bash
curl -X POST http://localhost:5000/convert/pdf-to-html \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "u_123",
    "upload_id": "up_789",
    "filename": "assignment.pdf",
    "relative_path": "Rahul_104/assignment.pdf"
  }'
```

Response is forwarded from converter module:

```json
{
	"status": "success",
	"user_id": "u_123",
	"formatted_path": "users/u_123/uploads/up_789/formatted/Rahul_104/assignment.html"
}
```

## Adding New Services

1. Create new module folder inside `modules/` (e.g., `modules/ai-detector/`)
2. Implement in your choice of framework
3. Register in Python Manager's config:

```python
# config.py
SERVICES = {
    "converter": { ... },
    "ai-detector": {
        "url": "http://localhost:5002",
        "endpoints": { "detect": "/detect" }
    }
}
```

4. Add route in Python Manager to forward requests:

```python
@app.post("/detect")
async def detect(request: DetectRequest):
    service = config.SERVICES["ai-detector"]
    response = requests.post(f"{service['url']}{service['endpoints']['detect']}", ...)
    return response.json()
```

## Important: Service Independence

- **Python Manager is just a router**, not a service
- Each module is independently deployable
- Modules can be written in any framework
- Modules communicate with MinIO directly
- Manager doesn't touch files; it just forwards requests

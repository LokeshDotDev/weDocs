# Reductor Service v3 - Quick Start Guide

## ✅ Service Created Successfully!

Your new **Reductor Service v3** has been created and is ready to use!

### 📁 Service Location
```
/Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode/python-manager/modules/reductor-service-v3
```

### 📦 Service Files
```
reductor-service-v3/
├── main.py                 # Core FastAPI application (~700 lines)
├── requirements.txt        # Python dependencies
├── start_server.sh         # Startup script (executable)
├── README.md              # Comprehensive documentation
└── QUICKSTART.md          # This file
```

---

## 🚀 Quick Start

### 1. Start the Service

```bash
cd /Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode/python-manager/modules/reductor-service-v3
./start_server.sh
```

**Expected Output:**
```
🚀 Starting Reductor Service v3...
📝 Purpose: Student NAME and ROLL NUMBER Redaction (Screenshot 2 Format)

📦 Creating virtual environment...
🔌 Activating virtual environment...
📦 Installing dependencies...

✅ Environment ready!

🌐 Starting FastAPI server...
📍 Host: 0.0.0.0
🔌 Port: 5018
📖 API Documentation: http://localhost:5018/docs
```

### 2. Verify Service is Running

```bash
# Check health
curl http://localhost:5018/health

# Get service info
curl http://localhost:5018/info
```

### 3. Access API Documentation

Open in browser: **http://localhost:5018/docs**

---

## 🎯 Supported Operations

### 1. Extract Student Identifiers
```bash
curl -X POST "http://localhost:5018/identify/text" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010\nCOURSE: DMBA114",
    "strict_mode": true
  }'
```

### 2. Redact Text
```bash
curl -X POST "http://localhost:5018/redact/text" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010\nCOURSE: DMBA114",
    "remove_name": true,
    "remove_roll_no": true
  }'
```

### 3. Redact Document
```bash
curl -X POST "http://localhost:5018/redact/document" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_path": "/path/to/document.docx",
    "output_file_path": "/path/to/redacted_document.docx",
    "file_format": "docx"
  }'
```

### 4. Batch Process
```bash
curl -X POST "http://localhost:5018/redact/batch" \
  -H "Content-Type: application/json" \
  -d '[
    {"input_file_path": "/path/to/doc1.docx", "output_file_path": "/path/to/out1.docx", "file_format": "docx"},
    {"input_file_path": "/path/to/doc2.pdf", "output_file_path": "/path/to/out2.pdf", "file_format": "pdf"}
  ]'
```

---

## 📚 Supported Formats

| Format | Read | Write | Extensions |
|--------|------|-------|-----------|
| DOCX | ✅ | ✅ | .docx |
| PDF | ✅ | ❌ | .pdf |
| TXT | ✅ | ✅ | .txt |

---

## 🔑 Key Features

✅ **Pattern Matching** - Detects NAME and ROLL NUMBER with high accuracy  
✅ **Flexible Patterns** - Handles formatting variations automatically  
✅ **Batch Processing** - Process multiple documents at once  
✅ **Multiple Formats** - DOCX, PDF, and TXT support  
✅ **Confidence Scoring** - Returns confidence levels for detections  
✅ **REST API** - Full-featured FastAPI with auto-documentation  
✅ **Error Handling** - Comprehensive error messages  

---

## 🔧 Configuration

### Change Port
```bash
PORT=5020 ./start_server.sh
```

### Change Host
```bash
HOST=127.0.0.1 PORT=5018 ./start_server.sh
```

---

## 📝 Service Information

| Property | Value |
|----------|-------|
| **Service Name** | Reductor Service v3 |
| **Version** | 3.0.0 |
| **Purpose** | Student NAME and ROLL NUMBER Redaction (Screenshot 2 Format) |
| **Default Port** | 5018 |
| **Framework** | FastAPI (Python) |
| **Documentation** | http://localhost:5018/docs |

---

## 🎓 Document Format

This service is optimized for Screenshot 2 format documents:

```
NAME: SHANMUGAPRIYA SIVAKUMAR
ROLL NUMBER: 25145050010
PROGRAM: MASTER OF BUSINESS ADMINISTRATION(MBA)
SEMESTER: 1
COURSE CODE & NAME: DMBA114- BUSINESS COMMUNICATION
```

**Removes:** NAME and ROLL NUMBER only  
**Preserves:** PROGRAM, SEMESTER, COURSE CODE, and all other content

---

## 🆚 Comparison with Service v2

| Feature | Service v2 | Service v3 |
|---------|------------|-----------|
| **Format** | Table-style (Screenshot 1) | Header-style (Screenshot 2) |
| **Target Fields** | Multiple table cells | NAME and ROLL NUMBER only |
| **Port** | 5017 | 5018 |
| **Specialization** | Structured tables | Unstructured headers |

---

## 🐛 Troubleshooting

### Service Won't Start
1. Check Python version: `python3 --version` (need 3.8+)
2. Verify port 5018 is available: `lsof -i :5018`
3. Check permissions: `ls -la start_server.sh`

### Identifiers Not Detected
1. Try with `"strict_mode": false` for flexible patterns
2. Verify text format matches expected pattern
3. Check raw text in response for debugging

### File Processing Fails
1. Verify file path exists and is readable
2. Check file format matches declared format
3. Ensure output directory exists

---

## 📖 Full Documentation

For complete API documentation and advanced usage:
1. Start the service
2. Visit: http://localhost:5018/docs
3. Or read: [README.md](README.md)

---

## 🚀 Next Steps

1. **Test the service:**
   ```bash
   curl http://localhost:5018/health
   ```

2. **Visit interactive API docs:**
   - http://localhost:5018/docs

3. **Try sample requests:**
   - Use the Swagger UI or cURL examples above

4. **Integrate with main app:**
   - Configure your application to use http://localhost:5018
   - Example endpoints: `/redact/text`, `/redact/document`

---

## 💡 Usage Example (Python)

```python
import requests

# Extract identifiers
response = requests.post(
    'http://localhost:5018/identify/text',
    json={
        'text': 'NAME: SHANMUGAPRIYA SIVAKUMAR\nROLL NUMBER: 25145050010',
        'strict_mode': True
    }
)
print(response.json())
# Output: {
#   "detected_name": "SHANMUGAPRIYA SIVAKUMAR",
#   "detected_roll_no": "25145050010",
#   "extraction_confidence": "high",
#   ...
# }

# Redact document
response = requests.post(
    'http://localhost:5018/redact/document',
    json={
        'input_file_path': '/path/to/doc.docx',
        'output_file_path': '/path/to/redacted.docx',
        'file_format': 'docx'
    }
)
print(response.json())
# Output: {
#   "status": "success",
#   "output_file": "/path/to/redacted.docx",
#   "redacted_name": "SHANMUGAPRIYA SIVAKUMAR",
#   "redacted_roll_no": "25145050010"
# }
```

---

## 📞 Support

- **API Docs:** http://localhost:5018/docs (when running)
- **Full README:** [README.md](README.md)
- **Health Check:** `curl http://localhost:5018/health`

---

**Service v3 is ready to use!** 🎉

Start it with: `./start_server.sh`

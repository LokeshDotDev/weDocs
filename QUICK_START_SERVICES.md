# 🚀 Quick Start - Running Services Command Cheatsheet

## Currently Running ✅

```bash
✅ PostgreSQL     - localhost:5433
✅ MinIO          - localhost:9000 (API), localhost:9001 (Console)
✅ OnlyOffice     - localhost:8080
✅ Frontend       - localhost:3000 (Next.js)
✅ Backend        - localhost:3000 (Express on :3000, proxied to :3001 for frontend)
✅ Converter      - localhost:5001
```

---

## 🚦 Start Each Service

### Start TUS Server (Port 4000)
```bash
cd tus-server
npm run dev
# OR if port 4000 is in use:
PORT=4001 npm run dev
```

### Start Humanizer (Python)
```bash
cd python-manager/modules/humanizer
source .venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Start AI Detector (Python)
```bash
cd python-manager/modules/ai-detector
source .venv/bin/activate
python api.py
# OR for production:
python -m flask run --host 0.0.0.0 --port 7000
```

### Start Python Manager (Optional)
```bash
cd python-manager
source .venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

---

## 🧪 Test Endpoints

### Frontend
```bash
curl http://localhost:3000
```

### Backend API
```bash
curl http://localhost:3000/api/health
```

### Converter
```bash
curl http://localhost:5001/health
```

### AI Detector
```bash
curl -X POST http://localhost:7000/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"Your text here"}'
```

### Humanizer
```bash
curl http://localhost:8001/health
```

### MinIO Console
```
http://localhost:9001
Username: minioadmin
Password: minioadmin
```

### OnlyOffice
```
http://localhost:8080
```

### PostgreSQL
```bash
psql -h localhost -p 5433 -U postgres -d wedocs
```

---

## 🔍 Troubleshooting Commands

### Check Port Usage
```bash
# Check if port is in use
lsof -i :4000    # Check port 4000
lsof -i :5001    # Check port 5001
lsof -i :8000    # Check port 8000

# Kill process on port
kill -9 <PID>
```

### Check Python Virtual Environments
```bash
# Verify venv exists
ls python-manager/.venv
ls python-manager/modules/converter-module/.venv
ls python-manager/modules/humanizer/.venv
ls python-manager/modules/ai-detector/.venv
```

### Verify Docker Containers
```bash
# List running containers
docker ps

# Check logs
docker logs postgres
docker logs minio
docker logs onlyoffice-document-server

# Stop all containers
docker-compose down

# Start only docker services
docker-compose up -d postgres minio onlyoffice-document-server
```

### Check Database
```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U postgres -d wedocs

# List tables
\dt

# Check if database exists
psql -h localhost -p 5433 -U postgres -l
```

### Check MinIO Buckets
```bash
# List buckets
mc ls minio/

# Check bucket contents
mc ls minio/wedocs/
```

---

## 📝 Environment Variables Quick Reference

### Ports
```
Frontend:  3000
Backend:   3000 (Express) → 3001 (Proxy from Frontend)
TUS:       4000
Converter: 5001
Python Mgr:5000
Humanizer: 8001 (was 8000, changed to avoid conflict)
AI Detect: 7000
MinIO API: 9000
MinIO Web: 9001
OnlyOffice:8080
Postgres:  5433
```

### Database
```
Host: localhost
Port: 5433
User: postgres
Password: postgres
Database: wedocs
```

### MinIO
```
Endpoint: localhost:9000
AccessKey: minioadmin
SecretKey: minioadmin
Bucket: wedocs
UseSSL: false
```

### AI Detector
```
BINOCULARS_SMALL_MODELS=1
HF_HOME=/Users/vivekvyas/.cache/huggingface
Model: falcon-rw-1b (1B parameters, ~2-3GB)
```

---

## 💾 Save Terminal Sessions

### Create a tmux session with all services
```bash
# Install tmux if needed: brew install tmux

tmux new-session -d -s vdocs
tmux new-window -t vdocs -n backend
tmux new-window -t vdocs -n converter
tmux new-window -t vdocs -n humanizer
tmux new-window -t vdocs -n detector
tmux new-window -t vdocs -n tus

# Start services
tmux send-keys -t vdocs:backend "cd server && npm run dev" Enter
tmux send-keys -t vdocs:converter "cd python-manager/modules/converter-module && source .venv/bin/activate && python -m uvicorn main:app --host 0.0.0.0 --port 5001" Enter
tmux send-keys -t vdocs:humanizer "cd python-manager/modules/humanizer && source .venv/bin/activate && python -m uvicorn main:app --host 0.0.0.0 --port 8001" Enter
tmux send-keys -t vdocs:detector "cd python-manager/modules/ai-detector && source .venv/bin/activate && python api.py" Enter
tmux send-keys -t vdocs:tus "cd tus-server && npm run dev" Enter

# Attach to session
tmux attach-session -t vdocs
```

---

## 📊 Performance Notes

### First AI Detection Request
- **Time**: 10-25 seconds (downloading models)
- **Models Downloaded**: ~2-3GB (falcon-rw-1b)
- **Memory**: ~4-8GB required
- **Subsequent Requests**: < 1 second (cached)

### Database Migrations
- **Status**: Already applied (no pending migrations)
- **Schema**: Located at `server/prisma/schema.prisma`

### File Upload Limits
- **Max Size**: 20GB per file
- **Storage**: MinIO object storage
- **Resumable**: Yes (TUS protocol)

---

## 🎯 Full System Test

```bash
#!/bin/bash

echo "🧪 Testing vDocs System..."

# Test Frontend
echo "Testing Frontend..."
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend OK" || echo "❌ Frontend Failed"

# Test Backend
echo "Testing Backend..."
curl -s http://localhost:3000/api/health > /dev/null && echo "✅ Backend OK" || echo "❌ Backend Failed"

# Test Converter
echo "Testing Converter..."
curl -s http://localhost:5001/health > /dev/null && echo "✅ Converter OK" || echo "❌ Converter Failed"

# Test MinIO
echo "Testing MinIO..."
curl -s http://localhost:9000/minio/health/live > /dev/null && echo "✅ MinIO OK" || echo "❌ MinIO Failed"

# Test Database
echo "Testing Database..."
psql -h localhost -p 5433 -U postgres -d wedocs -c "SELECT 1" > /dev/null 2>&1 && echo "✅ Database OK" || echo "❌ Database Failed"

# Test OnlyOffice
echo "Testing OnlyOffice..."
curl -s http://localhost:8080 > /dev/null && echo "✅ OnlyOffice OK" || echo "❌ OnlyOffice Failed"

echo "🎉 System test complete!"
```

Save as `test-system.sh` and run with `bash test-system.sh`

---

## 📞 Support & Documentation

- **Falcon Models**: See `FALCON_MODELS_SOLUTION.md`
- **Full Setup**: See `SETUP_COMPLETE.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Local Dev**: See `LOCAL_DEVELOPMENT_GUIDE.md`

---

**🟢 All systems ready for testing!**

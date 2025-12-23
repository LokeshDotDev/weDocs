# Quick Start: Bulk Humanizer (100+ Files)

## In 30 Seconds

1. **Go to** `/humanizer` page
2. **Click** "Select All" button
3. **Click** "Start Humanization" 
4. **Wait** for progress bar (0% → 100%)
5. **Download** all humanized files

## What You Get

✅ All files humanized in parallel (3 at a time)  
✅ Real-time progress tracking  
✅ Q&A structure preserved (questions + tables unchanged)  
✅ Only answers get rewritten  
✅ All files downloadable with one click  

## File Limits

| Number | Time |
|--------|------|
| 10 files | 1-2 min |
| 50 files | 5-10 min |
| 100 files | 10-20 min |

## Humanizer vs Reductor

| Use Case | Tool | File Type |
|----------|------|-----------|
| Rewrite Q&A answers | **Humanizer** | DOCX ✅ |
| Anonymize documents | **Reductor** | PDF ✅ |

## Bulk Selection

```
Select All Files:  Click "Select All" button
Select One File:   Click checkbox
Clear Selection:   Click "Clear All" button
See Count:         "Selected: X of Y files" shows current selection
```

## Progress Monitoring

- **Green bar** filling up = Processing in progress
- **100%** = All files done
- **Download** button appears for each file
- **Job ID** shown (for support if needed)

## File Structure Preserved

```
✅ Assignment Set heading     → UNCHANGED
✅ Questions (Q1, Q2...)      → UNCHANGED
✅ Tables                     → UNCHANGED
✨ Answers (A1, A2...)        → HUMANIZED
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Select All" disabled | Need to upload files first |
| Progress bar frozen | Check Python Manager running (`localhost:5002`) |
| Download fails | Refresh page, try again |
| Some files fail | Batch continues; check logs for that file |

## API Endpoint

```bash
# Start batch
curl -X POST http://localhost:3000/api/humanizer/humanize-batch \
  -H "Content-Type: application/json" \
  -d '{"fileKeys":["file1.docx","file2.docx"]}'

# Check status  
curl http://localhost:3000/api/humanizer/job/humanize-1708234567890
```

---

**Ready to process 100+ files? Click "Select All" and go!** 🚀

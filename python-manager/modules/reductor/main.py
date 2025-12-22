import os
import sys
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Wire the doc-anonymizer backend into path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MVP_ROOT = os.path.join(ROOT, "reductor-module", "doc-anonymizer-mvp")
MVP_BACKEND = os.path.join(MVP_ROOT, "backend")
# Ensure both package root and backend are importable so "backend.*" works
for p in (MVP_ROOT, MVP_BACKEND):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    # Import using the internal package layout expected by the MVP code
    from backend.batch.processor import process_docx  # type: ignore
except Exception as e:
    raise RuntimeError(f"Failed to import process_docx: {e}")

app = FastAPI(title="Reductor Service", version="0.1.0")


class TextRequest(BaseModel):
    text: str
    # Optional overrides for patterns later
    name_pattern: Optional[str] = None
    roll_pattern: Optional[str] = None


class TextResponse(BaseModel):
    anonymized_text: str
    detected_name: Optional[str] = None
    detected_roll_no: Optional[str] = None


class DocxRequest(BaseModel):
    input_file_path: str
    output_file_path: str


@app.get("/health")
def health():
    return {"status": "healthy", "service": "reductor"}


@app.post("/anonymize/text", response_model=TextResponse)
def anonymize_text(req: TextRequest):
    import re

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    # Heuristics similar to identity/detector.py
    name_pat = re.compile(req.name_pattern or r"\b[A-Z][a-z]+ [A-Z][a-z]+\b")
    roll_pat = re.compile(req.roll_pattern or r"\b\d{6,15}\b")

    name_match = name_pat.search(req.text)
    roll_match = roll_pat.search(req.text)

    out = req.text
    if roll_match:
        out = re.sub(re.escape(roll_match.group(0)), "", out)
    if name_match:
        out = re.sub(re.escape(name_match.group(0)), "", out, flags=re.IGNORECASE)

    return TextResponse(
        anonymized_text=out,
        detected_name=name_match.group(0) if name_match else None,
        detected_roll_no=roll_match.group(0) if roll_match else None,
    )


@app.post("/anonymize/docx")
def anonymize_docx(req: DocxRequest):
    if not os.path.exists(req.input_file_path):
        raise HTTPException(status_code=400, detail="input_file_path does not exist")
    out_dir = os.path.dirname(req.output_file_path) or "."
    os.makedirs(out_dir, exist_ok=True)
    try:
        process_docx(req.input_file_path, req.output_file_path)
        return {"status": "success", "output_file": req.output_file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "5017"))
    uvicorn.run(app, host="0.0.0.0", port=port)

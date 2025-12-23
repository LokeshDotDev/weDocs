"""
Smart DOCX humanizer for Q&A documents:
- Skip everything before "Assignment Set" heading
- Skip "Assignment Set" heading itself  
- Skip question paragraphs (Q1, Q2, etc.)
- ONLY humanize answer content (A1, A2, etc.)
- Never touch table formatting

Workflow:
- Reads DOCX as zip
- For answer paragraphs, concatenates text, sends to humanizer, writes back
- Preserves all formatting, styling, and layout
"""

import argparse
import io
import os
import re
import zipfile
from typing import Iterable, List, Optional

import requests
from lxml import etree


NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

DETECT_URL = os.environ.get("DETECT_URL", "http://localhost:5003/detect")
DETECT_FAST = os.environ.get("DETECT_FAST", "1") in ("1", "true", "True")
HUMANIZER_URL = os.environ.get("HUMANIZER_URL", "http://localhost:8000/humanize")


def _post_json(url: str, payload: dict, timeout: int = 60) -> dict:
    resp = requests.post(url, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def run_detector(text: str) -> Optional[dict]:
    if not DETECT_URL:
        return None
    url = DETECT_URL
    payload = {"text": text}
    if DETECT_FAST and url.endswith("/detect"):
        url = url + "?mode=fast"
    try:
        return _post_json(url, payload)
    except requests.RequestException:
        if url.endswith("/detect") or url.endswith("/detect?mode=fast"):
            alt = url.split("?")[0].rsplit("/", 1)[0] + "/detect-fast"
            return _post_json(alt, payload)
        raise


def run_humanizer(text: str) -> str:
    """Call humanizer with conservative settings to preserve layout."""
    payload = {
        "text": text,
        "p_syn": 0.0,              # disable synonyms to avoid spacing issues
        "p_trans": 0.2,            # light transitions
        "preserve_linebreaks": True,
    }
    data = _post_json(HUMANIZER_URL, payload, timeout=120)
    for key in ("human_text", "humanized_text", "text", "output", "result"):
        if key in data and isinstance(data[key], str):
            return data[key]
    if isinstance(data, str):
        return data
    raise ValueError("Humanizer response missing expected text field")


def _gather_text_nodes(paragraph: etree._Element) -> List[etree._Element]:
    return paragraph.xpath(".//w:t", namespaces=NSMAP)


def _joined_text(nodes: Iterable[etree._Element]) -> str:
    return "".join((node.text or "") for node in nodes)


def _redistribute_text(nodes: List[etree._Element], new_text: str) -> None:
    """Redistribute text across runs preserving word boundaries."""
    if not nodes:
        return
    
    words = new_text.split(' ')
    word_idx = 0
    
    for idx, node in enumerate(nodes):
        if word_idx >= len(words):
            node.text = ""
            continue
        
        orig_len = len(node.text or "")
        total_orig = sum(len(n.text or "") for n in nodes)
        
        if total_orig == 0:
            remaining_words = len(words) - word_idx
            remaining_nodes = len(nodes) - idx
            target_words = max(1, remaining_words // remaining_nodes) if remaining_nodes > 0 else remaining_words
        else:
            words_ratio = orig_len / total_orig if total_orig > 0 else 1.0
            remaining_words = len(words) - word_idx
            target_words = max(1, int(remaining_words * words_ratio))
        
        if idx == len(nodes) - 1:
            target_words = len(words) - word_idx
        
        chunk_words = words[word_idx:word_idx + target_words]
        chunk = ' '.join(chunk_words) if chunk_words else ""
        
        if word_idx + target_words < len(words):
            chunk += ' '
        
        node.text = chunk
        word_idx += target_words


def _norm(s: str) -> str:
    """Normalize string for comparison."""
    return " ".join((s or "").split()).lower()


def _is_question(text: str) -> bool:
    """Detect if paragraph is a question (Q1, Q2, etc.)."""
    norm = _norm(text)
    # Match: q1. q2. Q1: Q2: question 1, question 2, etc.
    return bool(re.match(r'^q\s*\d+[\.:]*', norm)) or bool(re.match(r'^question\s+\d+', norm))


def _is_answer(text: str) -> bool:
    """Detect if paragraph is an answer (A1, A2, etc.)."""
    norm = _norm(text)
    # Match: a1. a2. A1: A2: answer 1, answer 2, etc.
    return bool(re.match(r'^a\s*\d+[\.:]*', norm)) or bool(re.match(r'^answer\s+\d+', norm))


def _is_assignment_heading(text: str) -> bool:
    """Detect if paragraph is "Assignment Set" heading."""
    norm = _norm(text)
    return ("assignment" in norm) and ("set" in norm)


def _process_tree(tree: etree._ElementTree, skip_detect: bool = False) -> None:
    """
    Process document:
    1. Skip everything before "Assignment Set"
    2. Skip "Assignment Set" heading
    3. Skip all question paragraphs
    4. ONLY process answer paragraphs
    5. Leave tables untouched
    """
    processing_started = False

    for paragraph in tree.xpath("//w:p", namespaces=NSMAP):
        text_nodes = _gather_text_nodes(paragraph)
        if not text_nodes:
            continue
        
        original = _joined_text(text_nodes)
        if not original.strip():
            continue

        norm = _norm(original)
        
        # Stage 1: Wait for Assignment Set heading
        if not processing_started:
            if _is_assignment_heading(norm):
                processing_started = True
            # Skip everything before Assignment Set
            continue
        
        # Stage 2: After Assignment Set
        
        # Skip the Assignment Set heading itself
        if _is_assignment_heading(norm):
            continue
        
        # Skip question paragraphs
        if _is_question(norm):
            continue
        
        # ONLY process answer paragraphs
        if _is_answer(norm):
            # Humanize this answer paragraph
            if not skip_detect:
                run_detector(original)
            humanized = run_humanizer(original)
            _redistribute_text(text_nodes, humanized)
            continue
        
        # Skip short paragraphs (likely spacing or headings)
        if len(original.strip()) < 15:
            continue
        
        # For any other content after Assignment Set, also process
        # (in case there's additional content that needs humanizing)
        # But be conservative - maybe skip this for safety
        # For now, let's be strict and only process answers
        # Uncomment below to humanize non-Q&A content too:
        # if not skip_detect:
        #     run_detector(original)
        # humanized = run_humanizer(original)
        # _redistribute_text(text_nodes, humanized)


def _should_process(name: str) -> bool:
    """Only process main document, skip headers/footers."""
    if name == "word/document.xml":
        return True
    return False


def process_docx(input_path: str, output_path: str, skip_detect: bool = False) -> None:
    """Process DOCX file."""
    with zipfile.ZipFile(input_path, "r") as zin, zipfile.ZipFile(output_path, "w") as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if _should_process(item.filename):
                tree = etree.parse(io.BytesIO(data))
                _process_tree(tree, skip_detect=skip_detect)
                data = etree.tostring(
                    tree,
                    xml_declaration=True,
                    encoding="UTF-8",
                    standalone="yes",
                )
            zi = zipfile.ZipInfo(item.filename)
            zi.date_time = item.date_time
            zi.compress_type = item.compress_type
            zi.external_attr = item.external_attr
            zout.writestr(zi, data)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Humanize Q&A DOCX files - only modifies answers, preserves questions & tables"
    )
    parser.add_argument("--input", required=True, help="Path to input DOCX")
    parser.add_argument("--output", required=True, help="Path to write modified DOCX")
    parser.add_argument(
        "--skip-detect", action="store_true", help="Skip AI detection, humanize only"
    )
    args = parser.parse_args()

    if not HUMANIZER_URL:
        raise SystemExit("HUMANIZER_URL is not set")

    process_docx(args.input, args.output, skip_detect=args.skip_detect)


if __name__ == "__main__":
    main()

"""
DOCX text replacer that preserves formatting by editing XML in-place with lxml.

Workflow:
- Reads a DOCX as a zip.
- For paragraphs (including those inside tables), concatenates all run texts, sends
  the text to the humanizer (and optionally detector), and writes the new text back
  into the existing w:t nodes. Run styling, numbering, tables, images, headers, and
  layout stay intact because we do not restructure the document.

Env defaults:
  DETECT_URL      (default: http://localhost:5000/detect)
  HUMANIZER_URL   (default: http://localhost:8000/humanize)

Usage:
  python docx_humanize_lxml.py --input input.docx --output output.docx [--skip-detect]
"""

import argparse
import io
import os
import zipfile
from typing import Iterable, List, Optional

import requests
from lxml import etree


NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# Default detector now uses the Binoculars Flask on 5003 and fast endpoint if configured
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
        # Request fast path via query param or use /detect-fast if available
        url = url + "?mode=fast"
    try:
        return _post_json(url, payload)
    except requests.RequestException:
        # Fallback to /detect-fast explicitly
        if url.endswith("/detect") or url.endswith("/detect?mode=fast"):
            alt = url.split("?")[0].rsplit("/", 1)[0] + "/detect-fast"
            return _post_json(alt, payload)
        raise


def run_humanizer(text: str) -> str:
    # Use conservative settings to avoid word-merging issues in DOCX output.
    payload = {
        "text": text,
        "p_syn": 0.0,              # disable synonym replacement to preserve spacing
        "p_trans": 0.2,            # keep light transitions
        "preserve_linebreaks": True,
    }
    data = _post_json(HUMANIZER_URL, payload, timeout=120)
    # Try common keys; fall back to raw if needed.
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
    """
    Redistribute humanized text across original runs while preserving word boundaries.
    Instead of splitting by character count, split by word boundaries to avoid breaking words.
    """
    if not nodes:
        return
    
    # Split new text into words (preserve whitespace info)
    words = new_text.split(' ')
    word_idx = 0
    
    for idx, node in enumerate(nodes):
        if word_idx >= len(words):
            node.text = ""
            continue
        
        # Calculate how many words should go into this node
        # Try to match the original run's approximate share
        orig_len = len(node.text or "")
        total_orig = sum(len(n.text or "") for n in nodes)
        
        if total_orig == 0:
            # If all runs are empty, distribute words evenly
            remaining_words = len(words) - word_idx
            remaining_nodes = len(nodes) - idx
            target_words = max(1, remaining_words // remaining_nodes) if remaining_nodes > 0 else remaining_words
        else:
            # Distribute words proportional to original run size
            words_ratio = orig_len / total_orig if total_orig > 0 else 1.0
            remaining_words = len(words) - word_idx
            target_words = max(1, int(remaining_words * words_ratio))
        
        # Make sure last node gets all remaining words
        if idx == len(nodes) - 1:
            target_words = len(words) - word_idx
        
        # Collect target_words words
        chunk_words = words[word_idx:word_idx + target_words]
        chunk = ' '.join(chunk_words) if chunk_words else ""
        
        # Add space after chunk if not the last run and there are more words
        if word_idx + target_words < len(words):
            chunk += ' '
        
        node.text = chunk
        word_idx += target_words


def _norm(s: str) -> str:
    return " ".join((s or "").split()).lower()


def _process_tree(tree: etree._ElementTree, skip_detect: bool = False) -> None:
    # Only start humanizing AFTER encountering a paragraph containing
    # "Assignment Set" (case-insensitive). The heading itself is left intact.
    processing_started = False

    for paragraph in tree.xpath("//w:p", namespaces=NSMAP):
        text_nodes = _gather_text_nodes(paragraph)
        if not text_nodes:
            continue
        original = _joined_text(text_nodes)
        if not original.strip():
            continue

        norm = _norm(original)
        if not processing_started:
            # Trigger point: any paragraph that contains both "assignment" and "set"
            # handles variations like "Assignment Set - 1".
            if ("assignment" in norm) and ("set" in norm):
                processing_started = True
                # Do NOT modify the trigger paragraph itself.
                continue
            # Before the trigger, we skip any changes (tables/header-like blocks included)
            continue

        # After the trigger, humanize paragraphs while preserving layout
        if not skip_detect:
            run_detector(original)
        humanized = run_humanizer(original)
        _redistribute_text(text_nodes, humanized)


def _should_process(name: str) -> bool:
    # Only process the main document body.
    # Leave headers/footers untouched to guarantee page layout integrity.
    if name == "word/document.xml":
        return True
    return False


def process_docx(input_path: str, output_path: str, skip_detect: bool = False) -> None:
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
        description="Humanize DOCX text while preserving formatting via lxml"
    )
    parser.add_argument("--input", required=True, help="Path to input DOCX")
    parser.add_argument("--output", required=True, help="Path to write modified DOCX")
    parser.add_argument(
        "--skip-detect", action="store_true", help="Do not call the detector; call humanizer only"
    )
    args = parser.parse_args()

    if not HUMANIZER_URL:
        raise SystemExit("HUMANIZER_URL is not set; cannot proceed")

    process_docx(args.input, args.output, skip_detect=args.skip_detect)


if __name__ == "__main__":
    main()

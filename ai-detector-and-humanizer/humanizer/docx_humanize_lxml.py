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

DETECT_URL = os.environ.get("DETECT_URL", "http://localhost:5000/detect")
HUMANIZER_URL = os.environ.get("HUMANIZER_URL", "http://localhost:8000/humanize")


def _post_json(url: str, payload: dict, timeout: int = 60) -> dict:
    resp = requests.post(url, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def run_detector(text: str) -> Optional[dict]:
    if not DETECT_URL:
        return None
    return _post_json(DETECT_URL, {"text": text})


def run_humanizer(text: str) -> str:
    data = _post_json(HUMANIZER_URL, {"text": text}, timeout=120)
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
    orig_lengths = [len(node.text or "") for node in nodes]
    pos = 0
    for idx, node in enumerate(nodes):
        remaining = len(new_text) - pos
        if remaining <= 0:
            node.text = ""
            continue
        if idx == len(nodes) - 1:
            chunk = new_text[pos:]
        else:
            target_len = orig_lengths[idx] or max(1, remaining // (len(nodes) - idx))
            chunk = new_text[pos : pos + target_len]
        node.text = chunk
        pos += len(chunk)


def _process_tree(tree: etree._ElementTree, skip_detect: bool = False) -> None:
    for paragraph in tree.xpath("//w:p", namespaces=NSMAP):
        text_nodes = _gather_text_nodes(paragraph)
        if not text_nodes:
            continue
        original = _joined_text(text_nodes)
        if not original.strip():
            continue
        if not skip_detect:
            run_detector(original)
        humanized = run_humanizer(original)
        _redistribute_text(text_nodes, humanized)


def _should_process(name: str) -> bool:
    if name == "word/document.xml":
        return True
    if name.startswith("word/header") and name.endswith(".xml"):
        return True
    if name.startswith("word/footer") and name.endswith(".xml"):
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

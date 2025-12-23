"""
Diagnostics for DOCX anonymization and formatting checks.

Usage:
  # Show first 60 text nodes and count terms
  python3 diagnostics.py /path/to/file.docx

  # Compare before vs after anonymization
  python3 diagnostics.py /path/to/original.docx /path/to/anonymized.docx

This script helps validate that:
- Only student name and roll number are cleared
- Non-sensitive terms like 'Sales', 'Margin', 'Ratio', 'Profit' remain
- Text node counts remain stable (formatting preserved)
"""

import sys
from zipfile import ZipFile
from lxml import etree
from collections import Counter

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_text_nodes(docx_path: str):
    with ZipFile(docx_path, 'r') as z:
        xml = z.read('word/document.xml')
    root = etree.fromstring(xml)
    return [t.text or "" for t in root.xpath('//w:t', namespaces=WORD_NS)]


def summarize(docx_path: str):
    nodes = extract_text_nodes(docx_path)
    print(f"\nFile: {docx_path}")
    print(f"Total text nodes: {len(nodes)}")
    print("First 60 nodes:")
    for i, t in enumerate(nodes[:60]):
        print(f"[{i}] {repr(t)}")

    text_lower = " ".join(nodes).lower()
    terms = ["sales", "margin", "ratio", "profit"]
    counts = {term: text_lower.count(term) for term in terms}
    print("\nTerm counts:")
    for term, c in counts.items():
        print(f"- {term}: {c}")

    return set(nodes), counts


def compare(orig: str, anon: str):
    print("\n=== BEFORE (original) ===")
    set_before, counts_before = summarize(orig)
    print("\n=== AFTER (anonymized) ===")
    set_after, counts_after = summarize(anon)

    print("\n=== Comparison ===")
    print("Term deltas (after - before):")
    for term in ["sales", "margin", "ratio", "profit"]:
        delta = counts_after[term] - counts_before[term]
        print(f"- {term}: {delta:+}")

    # Sanity: ensure student data is cleared (nodes replaced by NBSP won't show up)
    missing = set_before - set_after
    print(f"\nApprox unique node removals: {len(missing)} (expected: small, only name/roll)")


if __name__ == "__main__":
    if len(sys.argv) == 2:
        summarize(sys.argv[1])
    elif len(sys.argv) == 3:
        compare(sys.argv[1], sys.argv[2])
    else:
        print(__doc__)

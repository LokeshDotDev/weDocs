#!/usr/bin/env python3
import os
import io
import zipfile
from pathlib import Path
import difflib

from lxml import etree

# Import the processor directly
import sys
sys.path.append(str(Path(__file__).resolve().parents[1] / 'modules' / 'humanizer'))
import docx_humanize_lxml as humanizer

NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def _content_types():
    return (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        b'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        b'<Default Extension="xml" ContentType="application/xml"/>'
        b'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        b'</Types>'
    )


def _rels_root():
    return (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        b'</Relationships>'
    )


def _document_xml():
    # Heading, question, long answer, table, long answer
    xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Section 1</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Q1. Explain photosynthesis in plants?</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Photosynthesis is the process by which green plants convert light energy into chemical energy, producing glucose and oxygen from carbon dioxide and water.</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Keep A</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Keep B</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Keep C</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Keep D</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:r><w:t>Additionally, chlorophyll pigments absorb specific wavelengths, enabling efficient energy capture and transfer during the light-dependent reactions.</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>
'''
    return xml.encode("utf-8")


def make_docx(path: Path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", _content_types())
        z.writestr("_rels/.rels", _rels_root())
        z.writestr("word/document.xml", _document_xml())


def read_doc_xml(path: Path):
    with zipfile.ZipFile(path, "r") as z:
        data = z.read("word/document.xml")
    return etree.fromstring(data)


def paragraph_texts(tree):
    return ["".join((t.text or "") for t in p.xpath(".//w:t", namespaces=NSMAP))
            for p in tree.xpath("//w:p[not(ancestor::w:tbl)]", namespaces=NSMAP)]


def list_tables(tree):
    return [etree.tostring(tbl) for tbl in tree.xpath("//w:tbl", namespaces=NSMAP)]


def runs_signature(tree):
    sigs = []
    for p in tree.xpath("//w:p[not(ancestor::w:tbl)]", namespaces=NSMAP):
        sig = []
        for r in p.xpath(".//w:r", namespaces=NSMAP):
            rpr = r.find(".//w:rPr", namespaces=NSMAP)
            sig.append(etree.tostring(rpr) if rpr is not None else b"<no-rPr>")
        sigs.append(sig)
    return sigs


def similar(a, b):
    return difflib.SequenceMatcher(a=a, b=b).ratio()


def main():
    tmp = Path(__file__).resolve().parent / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    inp = tmp / "e2e_input.docx"
    outp = tmp / "e2e_output.docx"

    make_docx(inp)

    # Read before
    before = read_doc_xml(inp)
    before_tables = list_tables(before)
    before_sigs = runs_signature(before)
    before_paras = paragraph_texts(before)

    # Process with our humanizer (in aggressive mode)
    os.environ.setdefault("HUMANIZER_AGGRESSIVE", "1")
    humanizer.process_docx(str(inp), str(outp), skip_detect=True)

    after = read_doc_xml(outp)
    after_tables = list_tables(after)
    after_sigs = runs_signature(after)
    after_paras = paragraph_texts(after)

    # Assertions
    assert len(before_tables) == len(after_tables), "Table count changed"
    for i, (a, b) in enumerate(zip(before_tables, after_tables)):
        assert a == b, f"Table {i} modified"

    assert len(before_sigs) == len(after_sigs), "Paragraph count changed"
    for i, (sa, sb) in enumerate(zip(before_sigs, after_sigs)):
        assert sa == sb, f"Run structure changed at paragraph {i}"

    # Paragraph 0: Heading -> unchanged
    assert before_paras[0] == after_paras[0], "Heading was modified"

    # Paragraph 1: Question -> unchanged
    assert before_paras[1].startswith("Q1"), "Second paragraph not a question"
    assert before_paras[1] == after_paras[1], "Question was modified"

    # Paragraph 2: Long answer -> should be changed (less similar)
    assert similar(before_paras[2], after_paras[2]) <= 0.90 and before_paras[2] != after_paras[2], "Answer (p2) not sufficiently changed"

    # Paragraph 3: Table (skipped above)

    # Paragraph 4: Long answer -> should be changed
    assert similar(before_paras[4], after_paras[4]) <= 0.90 and before_paras[4] != after_paras[4], "Answer (p4) not sufficiently changed"

    print("✅ E2E humanizer test passed: structure preserved, answers humanized.")


if __name__ == "__main__":
    main()

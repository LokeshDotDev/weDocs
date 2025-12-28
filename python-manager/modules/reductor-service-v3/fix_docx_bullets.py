"""
fix_docx_bullets.py

Post-process a DOCX file to patch all paragraphs that look like bullets (e.g., start with a bullet character or dash)
and add real Word list properties so they render as circular bullets in Microsoft Word.

Usage:
    python fix_docx_bullets.py input.docx output.docx
"""

import sys
import os
import zipfile
import tempfile
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

BULLET_CHARS = {'•', '◦', '▪', '–', '-', '●', '‣', '∙', '○', '□', '■', '◆', '▶', '→', '⇒', '➔', '➤', '➢', '➣', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➵', '➸', '➺', '➻', '➼', '➽', '➾'}

def unzip_docx(docx_path):
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(docx_path, 'r') as z:
        z.extractall(temp_dir)
    return temp_dir

def zip_docx(temp_dir, output_path):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for foldername, _, filenames in os.walk(temp_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, temp_dir)
                z.write(file_path, arcname)

def patch_numbering_xml(temp_dir):
    numbering_xml = os.path.join(temp_dir, "word/numbering.xml")
    from lxml import etree
    if not os.path.exists(numbering_xml):
        root = etree.Element("w:numbering", nsmap={"w": WORD_NAMESPACE["w"]})
        tree = etree.ElementTree(root)
    else:
        tree = etree.parse(numbering_xml)
        root = tree.getroot()
    # Check if numId=1 exists
    found = False
    for num in root.xpath("//w:num", namespaces=WORD_NAMESPACE):
        if num.get(f"{{{WORD_NAMESPACE['w']}}}numId") == "1":
            found = True
            break
    if not found:
        abstractNum = etree.Element(f"{{{WORD_NAMESPACE['w']}}}abstractNum")
        abstractNum.set(f"{{{WORD_NAMESPACE['w']}}}abstractNumId", "1")
        lvl = etree.SubElement(abstractNum, f"{{{WORD_NAMESPACE['w']}}}lvl")
        lvl.set(f"{{{WORD_NAMESPACE['w']}}}ilvl", "0")
        start = etree.SubElement(lvl, f"{{{WORD_NAMESPACE['w']}}}start")
        start.set(f"{{{WORD_NAMESPACE['w']}}}val", "1")
        numFmt = etree.SubElement(lvl, f"{{{WORD_NAMESPACE['w']}}}numFmt")
        numFmt.set(f"{{{WORD_NAMESPACE['w']}}}val", "bullet")
        lvlText = etree.SubElement(lvl, f"{{{WORD_NAMESPACE['w']}}}lvlText")
        lvlText.set(f"{{{WORD_NAMESPACE['w']}}}val", "•")
        lvlJc = etree.SubElement(lvl, f"{{{WORD_NAMESPACE['w']}}}lvlJc")
        lvlJc.set(f"{{{WORD_NAMESPACE['w']}}}val", "left")
        pPr = etree.SubElement(lvl, f"{{{WORD_NAMESPACE['w']}}}pPr")
        ind = etree.SubElement(pPr, f"{{{WORD_NAMESPACE['w']}}}ind")
        ind.set(f"{{{WORD_NAMESPACE['w']}}}left", "720")
        ind.set(f"{{{WORD_NAMESPACE['w']}}}hanging", "360")
        root.append(abstractNum)
        num = etree.Element(f"{{{WORD_NAMESPACE['w']}}}num")
        num.set(f"{{{WORD_NAMESPACE['w']}}}numId", "1")
        absNumId = etree.SubElement(num, f"{{{WORD_NAMESPACE['w']}}}abstractNumId")
        absNumId.set(f"{{{WORD_NAMESPACE['w']}}}val", "1")
        root.append(num)
    tree.write(numbering_xml, encoding="UTF-8", xml_declaration=True)

def patch_bullet_paragraphs(temp_dir):
    document_xml = os.path.join(temp_dir, "word/document.xml")
    tree = etree.parse(document_xml)
    root = tree.getroot()
    patched = 0
    for para in root.xpath("//w:p", namespaces=WORD_NAMESPACE):
        run = para.find("w:r", WORD_NAMESPACE)
        if run is not None:
            text_node = run.find("w:t", WORD_NAMESPACE)
            if text_node is not None and text_node.text and text_node.text.strip() in BULLET_CHARS:
                # Add <w:pPr> if missing
                pPr = para.find("w:pPr", WORD_NAMESPACE)
                if pPr is None:
                    pPr = etree.Element(f"{{{WORD_NAMESPACE['w']}}}pPr")
                    para.insert(0, pPr)
                # Add <w:pStyle w:val="ListBullet"/>
                pStyle = pPr.find("w:pStyle", WORD_NAMESPACE)
                if pStyle is None:
                    pStyle = etree.Element(f"{{{WORD_NAMESPACE['w']}}}pStyle")
                    pPr.insert(0, pStyle)
                pStyle.set(f"{{{WORD_NAMESPACE['w']}}}val", "ListBullet")
                # Add <w:numPr> with <w:ilvl w:val="0"/> and <w:numId w:val="1"/>
                numPr = pPr.find("w:numPr", WORD_NAMESPACE)
                if numPr is None:
                    numPr = etree.Element(f"{{{WORD_NAMESPACE['w']}}}numPr")
                    pPr.append(numPr)
                ilvl = numPr.find("w:ilvl", WORD_NAMESPACE)
                if ilvl is None:
                    ilvl = etree.Element(f"{{{WORD_NAMESPACE['w']}}}ilvl")
                    numPr.append(ilvl)
                ilvl.set(f"{{{WORD_NAMESPACE['w']}}}val", "0")
                numId = numPr.find("w:numId", WORD_NAMESPACE)
                if numId is None:
                    numId = etree.Element(f"{{{WORD_NAMESPACE['w']}}}numId")
                    numPr.append(numId)
                numId.set(f"{{{WORD_NAMESPACE['w']}}}val", "1")
                patched += 1
    tree.write(document_xml, encoding="UTF-8", xml_declaration=True)
    return patched

def fix_docx_bullets(input_docx, output_docx):
    temp_dir = unzip_docx(input_docx)
    try:
        patch_numbering_xml(temp_dir)
        patched = patch_bullet_paragraphs(temp_dir)
        zip_docx(temp_dir, output_docx)
        print(f"Patched {patched} bullet paragraphs.")
    finally:
        import shutil
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fix_docx_bullets.py input.docx output.docx")
        sys.exit(1)
    fix_docx_bullets(sys.argv[1], sys.argv[2])

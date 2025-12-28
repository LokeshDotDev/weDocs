def _remove_value_byte_level(docx_path: str, value: str) -> int:
    if not value or not value.strip():
        return 0
    import re
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        with open(document_xml, "rb") as f:
            xml_bytes = f.read()
        val_bytes = value.strip().encode("utf-8")
        pattern = b"(<w:t[^>]*>)" + re.escape(val_bytes) + b"(</w:t>)"
        replaced = re.sub(pattern, b"\\1\xC2\xA0\\2", xml_bytes, flags=re.IGNORECASE)
        bytes_removed = len(xml_bytes) - len(replaced)
        if bytes_removed > 0:
            with open(document_xml, "wb") as f:
                f.write(replaced)
        zip_docx(temp_dir, docx_path)
        return bytes_removed
    finally:
        import shutil
        shutil.rmtree(temp_dir)
def _ensure_bullet_numbering(docx_path: str) -> bool:
    """
    Ensure numbering.xml contains a standard bullet list definition with numId=1.
    Returns True if added or already present.
    """
    from lxml import etree
    temp_dir = unzip_docx(docx_path)
    try:
        numbering_xml = os.path.join(temp_dir, "word/numbering.xml")
        if not os.path.exists(numbering_xml):
            # Create minimal numbering.xml if missing
            root = etree.Element("w:numbering", nsmap={"w": WORD_NAMESPACE["w"]})
            tree = etree.ElementTree(root)
        else:
            tree = load_xml(numbering_xml)
            root = tree.getroot()
        # Check if numId=1 exists
        found = False
        for num in root.xpath("//w:num", namespaces=WORD_NAMESPACE):
            if num.get(f"{{{WORD_NAMESPACE['w']}}}numId") == "1":
                found = True
                break
        if found:
            zip_docx(temp_dir, docx_path)
            return True
        # Add bullet abstractNum and num
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
        zip_docx(temp_dir, docx_path)
        return True
    finally:
        import shutil
        shutil.rmtree(temp_dir)
def _make_bullets_native(docx_path: str) -> int:
    """
    Convert paragraphs with bullet-like runs into real Word lists (native bullets).
    Adds <w:numPr> and <w:pStyle w:val="ListBullet"/> to those paragraphs.
    Returns number of paragraphs patched.
    """
    from lxml import etree
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        tree = load_xml(document_xml)
        root = tree.getroot()
        bullet_chars = {'•', '◦', '▪', '–', '-', '●', '‣', '∙', '○', '□', '■', '◆', '▶', '→', '⇒', '➔', '➤', '➢', '➣', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➵', '➸', '➺', '➻', '➼', '➽', '➾'}
        patched = 0
        for para in root.xpath("//w:p", namespaces=WORD_NAMESPACE):
            # Find first run with text
            run = para.find("w:r", WORD_NAMESPACE)
            if run is not None:
                text_node = run.find("w:t", WORD_NAMESPACE)
                if text_node is not None and text_node.text and text_node.text.strip() in bullet_chars:
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
        zip_docx(temp_dir, docx_path)
        return patched
    finally:
        import shutil
        shutil.rmtree(temp_dir)
"""
docx_anonymizer.py

DOCX anonymization via text-node-level removal.

CRITICAL PRINCIPLE:
- NEVER re-serialize XML (breaks formatting)
- ONLY clear text node content
- Remove by exact text match in <w:t>VALUE</w:t>
- Fallback: byte-level replacement on document.xml
- Preserves all structure, spacing, alignment
"""

import os
import re
import zipfile
import tempfile
from lxml import etree

WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def unzip_docx(docx_path: str) -> str:
    temp_dir = tempfile.mkdtemp()
    with zipfile.ZipFile(docx_path, 'r') as z:
        z.extractall(temp_dir)
    return temp_dir


def load_xml(xml_path: str) -> etree._ElementTree:
    parser = etree.XMLParser(
        remove_blank_text=False,
        strip_cdata=False,
        remove_comments=False,
    )
    return etree.parse(xml_path, parser)


def zip_docx(temp_dir: str, output_path: str):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for foldername, _, filenames in os.walk(temp_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, temp_dir)
                z.write(file_path, arcname)


def _remove_value_from_text_nodes(docx_path: str, value: str) -> int:
    if not value or not value.strip():
        return 0
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        tree = load_xml(document_xml)
        root = tree.getroot()
        val_clean = value.strip().lower()
        removed_count = 0
        for text_node in root.xpath("//w:t", namespaces=WORD_NAMESPACE):
            if not text_node.text:
                continue
            node_text = text_node.text.strip()
            # Remove if exact match or contains the value (case-insensitive)
            if val_clean in node_text.lower():
                text_node.text = text_node.text.replace(value, "\u00A0")
                # If still present (case difference), replace lowercased
                if val_clean in text_node.text.lower():
                    import re
                    text_node.text = re.sub(re.escape(val_clean), "\u00A0", text_node.text, flags=re.IGNORECASE)
                removed_count += 1
        tree.write(document_xml, encoding="UTF-8", xml_declaration=True)
        zip_docx(temp_dir, docx_path)
        return removed_count
    finally:
        import shutil
        shutil.rmtree(temp_dir)
        return 0
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        with open(document_xml, "rb") as f:
            xml_bytes = f.read()
        val_bytes = value.strip().encode("utf-8")
        pattern = b"(<w:t[^>]*>)" + re.escape(val_bytes) + b"(</w:t>)"
        replaced = re.sub(pattern, b"\\1\xC2\xA0\\2", xml_bytes, flags=re.IGNORECASE)
        bytes_removed = len(xml_bytes) - len(replaced)
        if bytes_removed > 0:
            with open(document_xml, "wb") as f:
                f.write(replaced)
        zip_docx(temp_dir, docx_path)
        return bytes_removed
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def _fix_bullet_formatting(docx_path: str) -> int:
    temp_dir = unzip_docx(docx_path)
    try:
        document_xml = os.path.join(temp_dir, "word/document.xml")
        tree = load_xml(document_xml)
        root = tree.getroot()
        fixed = 0
        for run in root.xpath("//w:r", namespaces=WORD_NAMESPACE):
            rPr = run.find("w:rPr", WORD_NAMESPACE)
            if rPr is None:
                continue
            fonts = rPr.find("w:rFonts", WORD_NAMESPACE)
            if fonts is None:
                continue
            ascii_font = fonts.get(f"{{{WORD_NAMESPACE['w']}}}ascii", "")
            text_node = run.find("w:t", WORD_NAMESPACE)
            if ascii_font in ['Symbol', 'Wingdings', 'Webdings', 'MT Extra'] and text_node is not None and text_node.text:
                # Only replace with NBSP if not already
                if text_node.text.strip() != '\u00A0':
                    text_node.text = '\u00A0'
                    fixed += 1
        tree.write(document_xml, encoding="UTF-8", xml_declaration=True)
        zip_docx(temp_dir, docx_path)
        return fixed
    finally:
        import shutil
        shutil.rmtree(temp_dir)


def anonymize_docx(input_path: str, output_path: str, name: str = None, roll_no: str = None) -> dict:
    import shutil
    shutil.copy(input_path, output_path)
    stats = {
        "removed_name": 0,
        "removed_roll": 0,
        "bytes_removed": 0,
    }
    if roll_no:
        count = _remove_value_from_text_nodes(output_path, roll_no)
        if count == 0:
            count = _remove_value_byte_level(output_path, roll_no)
        stats["removed_roll"] = count
        stats["bytes_removed"] += count
    if name:
        count = _remove_value_from_text_nodes(output_path, name)
        if count == 0:
            count = _remove_value_byte_level(output_path, name)
        stats["removed_name"] = count
        stats["bytes_removed"] += count
    bullet_fixed = _fix_bullet_formatting(output_path)
    stats["bullets_fixed"] = bullet_fixed
    return stats

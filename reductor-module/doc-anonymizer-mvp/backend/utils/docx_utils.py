"""
docx_utils.py

Low-level DOCX utilities.
This file is responsible for:
- Unzipping a DOCX file
- Loading XML files using lxml
- Writing XML back
- Rezipping the DOCX without breaking structure

IMPORTANT:
- NEVER recreate XML from scratch
- ALWAYS modify existing XML trees
- This guarantees pixel-perfect layout preservation
"""

from zipfile import ZipFile
from lxml import etree
import tempfile
import os
import shutil


def unzip_docx(docx_path: str) -> str:
    temp_dir = tempfile.mkdtemp()
    with ZipFile(docx_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    return temp_dir


def load_xml(xml_path: str) -> etree._ElementTree:
    parser = etree.XMLParser(
        remove_blank_text=False,
        strip_cdata=False,
        remove_comments=False,
        remove_pis=False,
    )
    return etree.parse(xml_path, parser)


def save_xml(tree: etree._ElementTree, xml_path: str):
    tree.write(
        xml_path,
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=False,
        standalone=True
    )


def zip_docx(extracted_dir: str, output_docx: str):
    with ZipFile(output_docx, 'w') as zipf:
        for foldername, _, filenames in os.walk(extracted_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, extracted_dir)
                zipf.write(file_path, arcname)


def cleanup_temp_dir(temp_dir: str):
    shutil.rmtree(temp_dir)

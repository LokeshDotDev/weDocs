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
import os
import shutil
import tempfile


def unzip_docx(docx_path: str) -> str:
    """
    Unzip DOCX into a temporary directory.
    Returns path to extracted folder.
    """
    temp_dir = tempfile.mkdtemp()
    with ZipFile(docx_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    return temp_dir


def load_xml(xml_path: str) -> etree._ElementTree:
    """
    Load an XML file using lxml and return the parsed tree.
    Uses strict parser settings to preserve ALL whitespace and formatting.
    """
    parser = etree.XMLParser(
        remove_blank_text=False,
        strip_cdata=False,
        resolve_entities=False,
        remove_comments=False,
        remove_pis=False,
        huge_tree=False,
        collect_ids=False
    )
    return etree.parse(xml_path, parser)


def save_xml(tree: etree._ElementTree, xml_path: str):
    """
    Save XML with ABSOLUTE ZERO reformatting.
    Uses tostring to get bytes, then writes directly.
    """
    # Get the XML as bytes with minimal transformation
    xml_bytes = etree.tostring(
        tree,
        encoding='UTF-8',
        xml_declaration=True,
        pretty_print=False,
        method='xml'
    )
    
    # Write bytes directly - no further processing
    with open(xml_path, 'wb') as f:
        f.write(xml_bytes)


def zip_docx(extracted_dir: str, output_docx: str):
    """
    Rezip extracted DOCX folder back into a .docx file.
    """
    with ZipFile(output_docx, 'w') as zipf:
        for foldername, _, filenames in os.walk(extracted_dir):
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                arcname = os.path.relpath(file_path, extracted_dir)
                zipf.write(file_path, arcname)


def cleanup_temp_dir(temp_dir: str):
    """
    Remove temporary extracted directory.
    """
    shutil.rmtree(temp_dir)

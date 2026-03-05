"""PDF to image conversion service."""

from PIL import Image
from pdf2image import convert_from_bytes


def pdf_to_images(pdf_bytes: bytes, dpi: int = 200) -> list[Image.Image]:
    """Convert PDF bytes to a list of PIL Images, one per page."""
    return convert_from_bytes(pdf_bytes, dpi=dpi, fmt="jpeg")

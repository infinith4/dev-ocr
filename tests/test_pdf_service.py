"""Tests for PDF service."""

from io import BytesIO

import pytest


def test_pdf_to_images():
    """Test PDF to image conversion with a minimal PDF."""
    from backendapp.pdf_service import pdf_to_images

    # Create a minimal valid PDF
    pdf_content = b"""%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
206
%%EOF"""

    images = pdf_to_images(pdf_content)
    assert len(images) >= 1
    assert images[0].size[0] > 0
    assert images[0].size[1] > 0

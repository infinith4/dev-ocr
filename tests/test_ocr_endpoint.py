"""Tests for /ocr endpoint."""

import pytest
from fastapi.testclient import TestClient

from backendapp.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ocr_upload_unsupported_format():
    """Unsupported file type should return 400."""
    r = client.post(
        "/ocr",
        files={"file": ("test.xyz", b"dummy data", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "Unsupported file type" in r.json()["detail"]


def test_ocr_upload_too_large():
    """File exceeding 50MB should return 413."""
    large_data = b"x" * (50 * 1024 * 1024 + 1)
    r = client.post(
        "/ocr",
        files={"file": ("large.jpg", large_data, "image/jpeg")},
    )
    assert r.status_code == 413


def test_ocr_upload_image():
    """Upload a small test image (blank white) and verify response structure."""
    from io import BytesIO

    from PIL import Image

    # Create a small blank white image
    img = Image.new("RGB", (100, 100), "white")
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    r = client.post(
        "/ocr",
        files={"file": ("blank.jpg", buf, "image/jpeg")},
    )
    assert r.status_code == 200
    data = r.json()
    assert "text" in data
    assert "pages" in data
    assert "total_lines" in data
    assert isinstance(data["pages"], list)
    assert len(data["pages"]) == 1
    assert data["pages"][0]["page"] == 1


def test_ocr_response_model():
    """Verify OCR response fields have correct types."""
    from io import BytesIO

    from PIL import Image

    img = Image.new("RGB", (200, 200), "white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    r = client.post(
        "/ocr",
        files={"file": ("blank.png", buf, "image/png")},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["text"], str)
    assert isinstance(data["total_lines"], int)
    for page in data["pages"]:
        assert isinstance(page["page"], int)
        assert isinstance(page["text"], str)
        assert isinstance(page["line_count"], int)

"""Tests for OCR endpoint helpers and streaming formatters."""

import asyncio
import json

import pytest
from fastapi import HTTPException
from PIL import Image

from backendapp.main import _generate_markdown, _generate_ndjson, health, ocr_upload


class DummyUploadFile:
    def __init__(self, filename: str, content: bytes) -> None:
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


class MockEngine:
    """Mock OCR engine for testing."""

    def __init__(self, result=None):
        self._result = result or {"text": "mock text", "line_count": 1, "lines": ["mock text"]}

    def ocr_image(self, _img):
        return self._result


def _make_image_bytes(fmt: str = "PNG") -> bytes:
    import io

    image = Image.new("RGB", (32, 32), "white")
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def _make_images(count: int) -> list[Image.Image]:
    return [Image.new("RGB", (16, 16), "white") for _ in range(count)]


def test_health():
    assert health() == {"status": "ok"}


def test_ocr_upload_unsupported_format(monkeypatch):
    monkeypatch.setattr("backendapp.main.get_engine", lambda _name: MockEngine())
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ocr_upload(DummyUploadFile("test.xyz", b"dummy data"), engine_name="paddleocr"))

    assert exc_info.value.status_code == 400
    assert "Unsupported file type" in exc_info.value.detail


def test_ocr_upload_too_large(monkeypatch):
    monkeypatch.setattr("backendapp.main.get_engine", lambda _name: MockEngine())
    large_data = b"x" * (50 * 1024 * 1024 + 1)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(ocr_upload(DummyUploadFile("large.jpg", large_data), engine_name="paddleocr"))

    assert exc_info.value.status_code == 413


def test_ocr_upload_returns_ndjson_stream(monkeypatch):
    mock = MockEngine({"text": "alpha", "line_count": 1, "lines": ["alpha"]})
    monkeypatch.setattr("backendapp.main.get_engine", lambda _name: mock)

    response = asyncio.run(
        ocr_upload(DummyUploadFile("blank.png", _make_image_bytes()), engine_name="paddleocr")
    )

    assert response.media_type == "application/x-ndjson"
    lines = [json.loads(line) for line in _generate_ndjson(_make_images(1), mock)]
    assert lines == [
        {"event": "start", "total_pages": 1},
        {"event": "page", "page": 1, "text": "alpha", "line_count": 1},
        {"event": "done"},
    ]


def test_generate_markdown_single_page():
    mock = MockEngine({"text": "single page text", "line_count": 1, "lines": ["single page text"]})
    body = "".join(_generate_markdown(_make_images(1), "blank.png", mock))
    assert body == "single page text\n\n"


def test_ocr_upload_returns_markdown_stream(monkeypatch):
    mock = MockEngine({"text": "single page text", "line_count": 1, "lines": ["single page text"]})
    monkeypatch.setattr("backendapp.main.get_engine", lambda _name: mock)

    response = asyncio.run(
        ocr_upload(
            DummyUploadFile("blank.png", _make_image_bytes()),
            format="markdown",
            engine_name="paddleocr",
        )
    )

    assert response.media_type == "text/markdown; charset=utf-8"


def test_ocr_empty_result():
    mock = MockEngine({"text": "", "line_count": 0, "lines": []})
    lines = [json.loads(line) for line in _generate_ndjson(_make_images(1), mock)]
    assert lines[1]["text"] == ""
    assert lines[1]["line_count"] == 0


def test_generate_markdown_multi_page():
    page_results = iter(
        [
            {"text": "first page", "line_count": 1, "lines": ["first page"]},
            {"text": "second page", "line_count": 1, "lines": ["second page"]},
        ]
    )

    class MultiMock:
        def ocr_image(self, _img):
            return next(page_results)

    body = "".join(_generate_markdown(_make_images(2), "sample.pdf", MultiMock()))

    assert body == (
        "# OCR Result: sample.pdf\n\n"
        "## Page 1\n\n"
        "first page\n\n"
        "## Page 2\n\n"
        "second page\n\n"
    )

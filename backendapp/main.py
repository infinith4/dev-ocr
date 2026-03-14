"""FastAPI backend with OCR endpoints."""

import io
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

load_dotenv()

from backendapp.ocr_evaluation import evaluate_all_methods  # noqa: E402
from backendapp.ocr_service import DEFAULT_ENGINE, get_engine  # noqa: E402
from backendapp.pdf_service import pdf_to_images  # noqa: E402

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_engine(DEFAULT_ENGINE)
    yield


app = FastAPI(
    title="OCR Backend",
    description="FastAPI backend with PaddleOCR",
    version="0.2.0",
    lifespan=lifespan,
)
app.openapi_version = "3.0.3"


# --- Health Check ---


@app.get("/health")
def health():
    return {"status": "ok"}


# --- OCR Endpoint ---

SUPPORTED_IMAGES = {"jpg", "jpeg", "png", "tiff", "tif", "jp2", "bmp"}


@app.post("/ocr")
async def ocr_upload(
    file: UploadFile = File(...),
    format: str = Query("ndjson", pattern="^(ndjson|markdown)$"),
    engine_name: str = Query(DEFAULT_ENGINE, alias="engine", pattern="^(paddleocr|ndlocr)$"),
):
    """Upload a PDF or image file and get OCR text.

    Supported formats: jpg, jpeg, png, tiff, tif, jp2, bmp, pdf

    Query params:
    - format=ndjson (default): NDJSON streaming
    - format=markdown: Markdown streaming
    """
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 50MB.")

    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        images = pdf_to_images(contents)
    elif ext in SUPPORTED_IMAGES:
        images = [Image.open(io.BytesIO(contents))]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Supported: pdf, {', '.join(sorted(SUPPORTED_IMAGES))}",
        )

    selected_engine = get_engine(engine_name)

    if format == "markdown":
        return StreamingResponse(
            _generate_markdown(images, filename, selected_engine),
            media_type="text/markdown; charset=utf-8",
        )

    return StreamingResponse(
        _generate_ndjson(images, selected_engine),
        media_type="application/x-ndjson",
    )


def _generate_ndjson(images, ocr_engine):
    ocr = ocr_engine
    yield json.dumps({"event": "start", "total_pages": len(images)}) + "\n"
    for i, img in enumerate(images):
        try:
            result = ocr.ocr_image(img)
            yield json.dumps({
                "event": "page",
                "page": i + 1,
                "text": result["text"],
                "line_count": result["line_count"],
            }) + "\n"
        except Exception as e:
            yield json.dumps({"event": "error", "message": str(e)}) + "\n"
            return
    yield json.dumps({"event": "done"}) + "\n"


def _generate_markdown(images, filename: str, ocr_engine):
    ocr = ocr_engine
    multi = len(images) > 1
    if multi:
        yield f"# OCR Result: {filename}\n\n"
    for i, img in enumerate(images):
        try:
            result = ocr.ocr_image(img)
            if multi:
                yield f"## Page {i + 1}\n\n"
            yield result["text"] + "\n\n"
        except Exception as e:
            yield f"\n\n> **Error on page {i + 1}**: {e}\n\n"
            return


@app.post("/ocr/evaluate")
async def evaluate_ocr_output(
    expected_file: UploadFile = File(...),
    actual_text: str = Form(...),
):
    expected_bytes = await expected_file.read()
    if not expected_bytes:
        raise HTTPException(status_code=400, detail="expected_file is empty.")
    if not actual_text:
        raise HTTPException(status_code=400, detail="actual_text is empty.")

    try:
        expected_text = expected_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="expected_file must be UTF-8 text.") from exc

    results = evaluate_all_methods(expected_text, actual_text)
    return {
        "normalization_summary": results[0].normalization_summary,
        "results": [result.to_dict() for result in results],
    }

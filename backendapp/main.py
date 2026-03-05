"""FastAPI backend with OCR endpoints."""

import io
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

load_dotenv()

from backendapp.ocr_service import engine  # noqa: E402
from backendapp.pdf_service import pdf_to_images  # noqa: E402

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.initialize()
    yield


app = FastAPI(
    title="OCR Backend",
    description="FastAPI backend with ndlocr-lite OCR",
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


class OCRPageResult(BaseModel):
    page: int
    text: str
    line_count: int


class OCRResponse(BaseModel):
    text: str
    pages: list[OCRPageResult]
    total_lines: int


@app.post("/ocr", response_model=OCRResponse)
async def ocr_upload(file: UploadFile = File(...)):
    """Upload a PDF or image file and get OCR text.

    Supported formats: jpg, jpeg, png, tiff, tif, jp2, bmp, pdf
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

    pages: list[OCRPageResult] = []
    all_text_parts: list[str] = []
    total_lines = 0

    for i, img in enumerate(images):
        result = engine.ocr_image(img)
        pages.append(
            OCRPageResult(
                page=i + 1,
                text=result["text"],
                line_count=result["line_count"],
            )
        )
        all_text_parts.append(result["text"])
        total_lines += result["line_count"]

    return OCRResponse(
        text="\n\n".join(all_text_parts),
        pages=pages,
        total_lines=total_lines,
    )

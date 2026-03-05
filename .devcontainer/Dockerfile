FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# poppler-utils: PDF→画像変換 (pdf2image)
# libgl1, libglib2.0-0: OpenCV 依存
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

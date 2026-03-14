#!/usr/bin/env bash
set -euo pipefail

npm config set prefix "$HOME/.npm-global"
npm install -g eslint prettier @openai/codex
pip install --user ruff black

# Install backend dependencies (including PaddleOCR)
pip install --user -r /workspaces/dev-ocr/backendapp/requirements.txt

# Pre-download PaddleOCR Japanese models
PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='japan', use_textline_orientation=True)"

# Install frontend dependencies
cd /workspaces/dev-ocr/frontend && npm install

mkdir -p "$HOME/bin"


echo 'export PATH="$PATH:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.dotnet/tools:$HOME/bin"' >>"$HOME/.bashrc"

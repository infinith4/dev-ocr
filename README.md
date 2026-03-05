# dev-ocr

AI駆動の OCR（光学文字認識）プラットフォームです。PDF や画像からテキストを抽出し、LLM（大規模言語モデル）と連携したチャット機能を提供します。

## 主な機能

- **OCR テキスト抽出** — PDF・画像ファイルから日本語テキストを認識（ndlocr-lite エンジン）
- **マルチプロバイダ LLM チャット** — OpenAI / Claude / Azure / Gemini を LiteLLM 経由で切替可能
- **ドラッグ＆ドロップ UI** — React フロントエンドでファイルをアップロード、ページ単位で結果表示
- **LLM トレーシング** — Langfuse による自動モニタリング

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + TypeScript + Vite |
| バックエンド | Python + FastAPI + Uvicorn |
| OCR エンジン | ndlocr-lite（DEIM + PARSEQ） |
| PDF 変換 | pdf2image + poppler-utils |
| LLM ルーティング | LiteLLM + Langfuse |
| テスト | pytest |
| 開発環境 | Dev Containers（Docker） |

## 対応ファイル形式

PDF, JPG, JPEG, PNG, TIFF, JP2, BMP（最大 50MB）

## セットアップ

### Dev Container（推奨）

1. VS Code で本リポジトリを開く
2. `Ctrl+Shift+P` → **Dev Containers: Reopen in Container** を実行
3. 自動で依存関係がインストールされる（`postCreate.sh`）

### 手動セットアップ

```bash
# バックエンド
pip install -r backendapp/requirements.txt

# フロントエンド
cd frontend
npm install
```

## 起動方法

### バックエンド

```bash
uvicorn backendapp.main:app --reload
```

API ドキュメント: http://localhost:8000/docs

### フロントエンド

```bash
cd frontend
npm run dev
```

アプリケーション: http://localhost:5173

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/health` | ヘルスチェック |
| `POST` | `/ocr` | ファイルをアップロードして OCR 実行 |
| `POST` | `/chat` | LLM チャット |
| `GET` | `/items` | アイテム一覧取得 |
| `POST` | `/items` | アイテム作成 |
| `GET` | `/items/{item_id}` | アイテム取得 |
| `PUT` | `/items/{item_id}` | アイテム更新 |
| `DELETE` | `/items/{item_id}` | アイテム削除 |

## 使い方

### OCR（Web UI）

1. http://localhost:5173 を開く
2. PDF または画像ファイルをドラッグ＆ドロップ（またはクリックして選択）
3. OCR 処理が完了するとページ単位でテキストが表示される
4. 「コピー」ボタンで結果をクリップボードにコピー

### OCR（API）

```bash
curl -X POST http://localhost:8000/ocr -F "file=@sample.pdf"
```

### LLM チャット（API）

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは", "model": "openai/gpt-4o"}'
```

## 環境変数

LLM チャット機能を利用する場合、`.env` ファイルに API キーを設定してください。

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_API_KEY=...
GEMINI_API_KEY=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

## テスト

```bash
python -m pytest tests/
```

## プロジェクト構成

```
dev-ocr/
├── backendapp/           # FastAPI バックエンド
│   ├── main.py           # アプリケーション & エンドポイント
│   ├── ocr_service.py    # OCR エンジン
│   ├── pdf_service.py    # PDF→画像変換
│   └── requirements.txt
├── frontend/             # React フロントエンド
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/ocr.ts
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
├── tests/                # テストコード
├── docs/                 # ドキュメント
├── .devcontainer/        # Dev Container 設定
├── CLAUDE.md             # Claude Code ガイド
└── AGENTS.md             # AI エージェント定義
```

## ライセンス

[LICENSE](LICENSE) を参照してください。

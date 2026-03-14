# OCR結果の Markdown 出力対応

## Context
OCR結果をMarkdownファイルとして出力したい。バックエンドAPI、フロントエンドUI、CLIスクリプトの3箇所すべてで対応する。既存のNDJSONストリーミングを活かしつつ、Markdown形式の出力オプションを追加する。

## 変更内容

### 1. バックエンドAPI: `backendapp/main.py`
- `/ocr` に `format` クエリパラメータを追加（`ndjson`（デフォルト）/ `markdown`）
- `format=markdown` 時は `StreamingResponse(text/markdown)` でページ単位にMarkdownをストリーミング
- Markdown形式（複数ページ時）:
  ```markdown
  # OCR Result: {filename}

  ## Page 1

  （OCRテキスト）

  ## Page 2

  （OCRテキスト）
  ```
- 1ページのみの場合はページ見出しを省略し、テキストのみ出力

### 2. フロントエンドUI: `frontend/src/components/OcrResult.tsx`
- 「Download .md」ボタンを追加（既存Copyボタンの隣）
- クリックで OCR 結果を Markdown 形式に整形し、`Blob` + `URL.createObjectURL` でダウンロード
- ファイル名: 元ファイル名の拡張子を `.md` に置換

### 3. フロントエンドUI: `frontend/src/App.tsx`
- `filename` state を追加し、選択されたファイル名を保持
- `OcrResult` に `filename` prop を渡す

### 4. CLIスクリプト: `scripts/ocr2md.sh` (新規)
- curl で `/ocr?format=markdown` にPOSTし、ストリーミング出力をファイルに保存
- 使い方: `./scripts/ocr2md.sh input.pdf [output.md]`
- output.md 省略時は `{入力ファイル名}.md` に自動保存

## 対象ファイル
- `backendapp/main.py` — format パラメータ追加、Markdownジェネレーター追加
- `frontend/src/components/OcrResult.tsx` — ダウンロードボタン追加
- `frontend/src/App.tsx` — filename state 追加・prop受け渡し
- `scripts/ocr2md.sh` — 新規CLIスクリプト

## 検証方法
1. `curl -N -X POST "http://localhost:8000/ocr?format=markdown" -F "file=@test.pdf"` でMarkdownがストリーム出力される
2. `./scripts/ocr2md.sh test.pdf` で `.md` ファイルが生成される
3. フロントエンドで OCR 実行後「Download .md」ボタンで `.md` がダウンロードされる

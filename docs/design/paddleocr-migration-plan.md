# PaddleOCR 移行プラン

## 1. 概要

現在の OCR エンジン（ndlocr-lite）を [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) に置き換える。
PaddleOCR は多言語対応・高精度な OCR フレームワークであり、PP-OCRv4 モデルによるテキスト検出・認識・方向分類を統合的に提供する。

## 2. 現状分析

### 現在のアーキテクチャ

```
[Frontend (React)] → POST /ocr → [FastAPI] → [ndlocr-lite OCREngine] → NDJSON/Markdown レスポンス
```

### 現在の OCR エンジン構成（ndlocr-lite）

| コンポーネント | 技術 |
|---------------|------|
| テキスト検出 | DEIM（ONNX） |
| テキスト認識 | PARSeQ（ONNX、30/50/100文字モデル3段カスケード） |
| 読み順推定 | xy-cut アルゴリズム |
| 方向判定 | 縦書き比率による自動判定 |
| 出力形式 | XML → 行テキストリスト |

### 現在の依存パッケージ

- `ndlocr-lite` (Git インストール)
- 内部依存: `deim`, `parseq`, `ndl_parser`, `reading_order`

## 3. PaddleOCR との比較

| 項目 | ndlocr-lite | PaddleOCR (PP-OCRv4) |
|------|-------------|----------------------|
| 対象言語 | 日本語特化（NDL 歴史資料向け） | 80+ 言語対応 |
| テキスト検出 | DEIM | DBNet++ |
| テキスト認識 | PARSeQ（カスケード） | SVTR-LCNet |
| 方向分類 | 手動（縦横比判定） | 組込み分類器（use_angle_cls） |
| 縦書き対応 | 高精度（NDL 専用学習済み） | 限定的（横書き中心） |
| 出力情報 | テキストのみ | バウンディングボックス + テキスト + 信頼度 |
| モデル形式 | ONNX | PaddlePaddle (Inference Model) |
| パッケージサイズ | 軽量 | 大（paddlepaddle ~1GB） |
| GPU 対応 | CPU（ONNX Runtime） | CPU / GPU（CUDA） |
| ライセンス | MIT | Apache 2.0 |

## 4. 移行方針

### 4.1 基本方針

- **APIインターフェースは維持** — `main.py` およびフロントエンドに変更を加えない
- **`OCREngine` クラスのインターフェースを維持** — `initialize()` / `ocr_image()` の呼び出し規約を変えない
- **段階的移行** — まず PaddleOCR 単体で置き換え、精度評価後に必要であれば併用モードを検討

### 4.2 スコープ

| 対象 | 変更有無 | 内容 |
|------|---------|------|
| `backendapp/requirements.txt` | 変更 | 依存パッケージ差し替え |
| `backendapp/ocr_service.py` | 全面書き換え | PaddleOCR ベースの実装 |
| `backendapp/main.py` | 変更なし | インターフェース維持のため |
| `backendapp/pdf_service.py` | 変更なし | PDF→画像変換は共通 |
| `frontend/` | 変更なし | API 形式維持のため |
| `tests/test_ocr_endpoint.py` | 修正 | モック対象の変更 |
| `Dockerfile`（将来） | 追加/修正 | モデル事前ダウンロード対応 |

## 5. 実装計画

### Step 1: 依存パッケージの変更

**ファイル:** `backendapp/requirements.txt`

```diff
- ndlocr-lite @ git+https://github.com/ndl-lab/ndlocr-lite.git
+ paddlepaddle>=2.6.0
+ paddleocr>=2.9.0
```

> **注意:** GPU 利用時は `paddlepaddle` を `paddlepaddle-gpu` に置き換える。

### Step 2: OCR サービスの書き換え

**ファイル:** `backendapp/ocr_service.py`

新しい実装:

```python
"""OCR Service wrapping PaddleOCR."""

import numpy as np
from PIL import Image
from paddleocr import PaddleOCR


class OCREngine:
    """PaddleOCR ベースの OCR エンジン。"""

    def __init__(self) -> None:
        self._ocr: PaddleOCR | None = None
        self._initialized = False

    def initialize(self) -> None:
        """PaddleOCR モデルをロード。アプリ起動時に1回呼ぶ。"""
        self._ocr = PaddleOCR(
            use_angle_cls=True,
            lang="japan",
            use_gpu=False,
            show_log=False,
        )
        self._initialized = True

    def ocr_image(self, pil_image: Image.Image) -> dict:
        """PIL Image に対して OCR を実行。

        Returns:
            dict with keys: text, line_count, lines
        """
        if not self._initialized:
            raise RuntimeError("OCR engine not initialized. Call initialize() first.")

        img = np.array(pil_image.convert("RGB"))
        results = self._ocr.ocr(img, cls=True)

        lines: list[str] = []
        if results and results[0]:
            for line in results[0]:
                _box, (text, _confidence) = line
                lines.append(text)

        full_text = "\n".join(lines)
        return {
            "text": full_text,
            "line_count": len(lines),
            "lines": lines,
        }


# Module-level singleton
engine = OCREngine()
```

#### 変更ポイント

| 項目 | 旧（ndlocr-lite） | 新（PaddleOCR） |
|------|-------------------|-----------------|
| モデルロード | DEIM + PARSeQ × 3 個別ロード | `PaddleOCR()` 1行で完了 |
| 検出 | `self._detector.detect(img)` | `self._ocr.ocr(img)` に統合 |
| 認識 | `process_cascade()` 3段階 | `self._ocr.ocr(img)` に統合 |
| 読み順 | XML 生成 → xy-cut | PaddleOCR 内部で処理 |
| 縦書き判定 | 手動（tatelinecnt 比率） | `use_angle_cls=True` で自動 |
| コード行数 | ~100行 | ~40行 |

### Step 3: テストの更新

**ファイル:** `tests/test_ocr_endpoint.py`

- ndlocr-lite 固有のモジュール（`deim`, `parseq`, `ndl_parser`）のモックを `paddleocr.PaddleOCR` のモックに変更
- OCR 結果のアサーションを PaddleOCR の出力形式に合わせる

### Step 4: 動作確認

```bash
# 依存パッケージインストール
pip install paddlepaddle>=2.6.0 paddleocr>=2.9.0

# バックエンド起動（初回はモデル自動ダウンロード）
uvicorn backendapp.main:app --reload

# テスト実行
pytest tests/

# 手動確認: 画像ファイルで OCR
curl -X POST http://localhost:8000/ocr \
  -F "file=@sample.png" \
  -H "Accept: application/x-ndjson"
```

### Step 5: Docker 対応（必要に応じて）

初回起動時のモデルダウンロードを避けるため、Dockerfile 内で事前取得:

```dockerfile
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='japan', use_gpu=False)"
```

## 6. 追加検討事項

### 6.1 信頼度情報の活用

PaddleOCR は各行の confidence を返す。将来的に API レスポンスに追加可能:

```python
# ocr_image() の拡張例
lines_with_conf = []
for line in results[0]:
    box, (text, confidence) = line
    lines_with_conf.append({"text": text, "confidence": confidence, "box": box})
```

NDJSON イベントの拡張:
```json
{"event": "page", "page": 1, "text": "...", "line_count": 10, "avg_confidence": 0.95}
```

### 6.2 多言語対応

`lang` パラメータを API クエリパラメータとして公開可能:

```
POST /ocr?format=ndjson&lang=en
```

対応言語例: `japan`, `en`, `ch`, `korean`, `french`, `german` 等

### 6.3 縦書き精度の補完

PaddleOCR の日本語縦書き精度が不十分な場合の選択肢:

1. **PP-Structure の Table/Layout 認識** を併用してレイアウト解析を強化
2. **ndlocr-lite との併用モード** — 縦書き検出時のみ ndlocr-lite にフォールバック
3. **カスタムモデル学習** — PaddlePaddle のファインチューニング機能で縦書きデータを追加学習

### 6.4 パフォーマンス

| 項目 | 推定値 |
|------|--------|
| モデルロード時間 | 3-5 秒（CPU） |
| 画像1枚あたり推論 | 1-3 秒（CPU、A4文書） |
| メモリ使用量 | ~500MB（モデルロード後） |
| GPU 利用時の高速化 | 3-5x |

## 7. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 日本語縦書き精度の低下 | 高 | 移行前に既存テストデータで精度比較を実施 |
| paddlepaddle パッケージサイズ大 | 中 | `paddlepaddle` の lite 版検討、Docker マルチステージビルド |
| 初回モデルダウンロード | 低 | Dockerfile で事前ダウンロード |
| PaddlePaddle と PyTorch の共存 | 中 | 仮想環境を分離、または PyTorch 依存を除去 |
| Python バージョン互換性 | 低 | PaddleOCR の対応バージョン（3.8-3.12）を確認 |

## 8. スケジュール目安

| フェーズ | 作業内容 | 工数 |
|----------|---------|------|
| Step 1 | 依存パッケージ変更・インストール確認 | 0.5h |
| Step 2 | ocr_service.py 書き換え | 1h |
| Step 3 | テスト更新 | 1h |
| Step 4 | 動作確認・精度比較 | 2h |
| Step 5 | Docker 対応（任意） | 1h |
| **合計** | | **5.5h** |

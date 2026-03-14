# Frontend OCR評価表示の実装プラン

  ## Summary

  既存の OCR UI に「評価」セクションを追加し、OCR結果と任意の期待値 Markdown を比較で
  きるようにする。評価はバックエンド API 経由で実行し、python-Levenshtein と jiwer の
  両結果を同時表示する。導線は OCR 結果表示とは分けた同一画面内の別セクションに置き、
  既存の OCR 実行フローは壊さない。

  ## Key Changes

  - バックエンドに評価 API を追加する。
      - POST /ocr/evaluate
      - 入力は expected_file と actual_text を基本形にする
      - 初期実装では OCR結果を画面から直接送る前提にし、actual_file アップロードは追
        加しない
      - レスポンスは normalization_summary と、python-Levenshtein / jiwer の 2 件の評
        価結果配列を返す
  - 既存の backendapp.ocr_evaluation を API 向けに再利用する。
      - 共通のレスポンス整形関数を追加し、 dataclass を JSON 化しやすくする
      - CER 判定は現状通り Good / Average / Poor
      - バックエンドは 2 方式を常に両方返す
  - フロント API 層に評価呼び出しを追加する。
      - frontend/src/api/ocr.ts に評価用の型と evaluateOcrResult(...) を追加
      - 入力は expectedFile: File, actualText: string
      - 出力は methods 配列または method 名をキーにした評価オブジェクト
  - フロント UI に評価セクションを追加する。
      - 配置は OCR結果とは独立した下段セクション
      - 期待値 Markdown のアップロード欄を追加
      - OCR結果が存在するときだけ「評価実行」ボタンを有効化
      - 評価完了後、2 方式のカードを横並びまたは縦積みで表示
      - 各カードに CER, WER, char_distance, word_distance, rating, method を表示
      - normalization_summary はセクション上部か注記に 1 回だけ表示
  - UI 状態管理を App.tsx に追加する。
      - evaluationLoading, evaluationError, evaluationResult, expectedFile
      - OCRを再実行したら旧評価結果はクリアする
      - 期待値ファイルを差し替えたら再評価待ち状態に戻す
  - 表示文言は「日本語では CER を主指標として見る」ことが分かるようにする。
      - WER は補助指標としてラベル付けする
      - 2 方式で CER/WER が完全一致しない場合があるため、比較表示は「参考差」として扱
        う

  ## Public Interfaces / Types

  - 新規 API
      - POST /ocr/evaluate
  - 新規リクエスト仕様
      - multipart/form-data
      - expected_file: Markdown/Text ファイル
      - actual_text: OCR結果文字列
  - 新規レスポンス仕様
      - normalization_summary: string
      - results: Array<{ method, cer, wer, char_distance, word_distance,
        expected_char_count, expected_word_count, rating }>
  - フロント型
      - OcrEvaluationMethodResult
      - OcrEvaluationResponse
  - 既存の OCR API や OCR 結果表示型は破壊的変更をしない

  ## Test Plan

  - バックエンド
      - 新規 API の単体テストで expected_file + actual_text から 2 方式の結果が返る
      - expected_file 未指定、空ファイル、空文字列、非 UTF-8 相当の入力で妥当なエラー
        が返る
      - 既存の testsdata/expect_提出用 1.md と OCR結果文字列相当を使い、両方式が返る
        ことを確認する
  - フロント
      - 成功時に 2 方式の結果カードが表示される
      - OCR再実行で旧評価結果がクリアされる
  - E2E 相当の確認
      - OCR実行 → 期待値 Markdown 選択 → 評価実行 → CER/WER/rating が画面に出る
      - モバイル幅でレイアウトが崩れない

  ## Assumptions

  - フロントで確認したい対象は testsdata 固定ではなく、ユーザーが任意に与える期待値
    Markdown との比較である
  - 評価導線は OCR結果の直後に密結合させず、同一画面の別セクションとして分ける
  - 評価方式は UI 切替ではなく、python-Levenshtein と jiwer を両方同時表示する
  - 初版では OCR結果はアップロードファイルから再読込せず、画面に保持している OCR テキ
    ストを actual_text として送る
  - 初版では固定サンプル閲覧機能や評価履歴保存は追加しない
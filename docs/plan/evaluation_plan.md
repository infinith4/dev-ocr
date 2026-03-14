# OCR 評価実装計画

  ## Summary

  deepsearch.md に基づく OCR 評価仕組みを実装する。評価実装は 2 系統用意する。

  - python-Levenshtein を使う方法
  - jiwer を使う方法

  両方とも testsdata/expect_提出用 1.md を正解データ、実在する結果ファイルを OCR 出力
  として比較し、CER、WER、距離系指標、判定を返す。pytest から両実装を同じ入力で呼べる
  構成にする。

  # OCR評価仕組み追加計画

  ## Summary
  `deepsearch.md` に基づいて、OCR結果と正解データを比較する評価仕組みを追加する。評価方
法は2系統とし、`python-Levenshtein` を使う方法と `jiwer` を使う方法の両方を実装する。日
本語文書の主指標は `CER`、補助指標は `WER` と `Levenshtein距離` とする。pytest ベースで
継続評価できるようにし、今回の `testsdata/expect_提出用 1.md` と OCR結果ファイルを最初
の比較対象にする。

  ## Key Changes
  - 評価モジュールを追加し、同じインターフェースで2種類の評価バックエンドを提供する。
  - 共通入力は `expected_text`, `actual_text` とする。
  - 共通出力は `method`, `cer`, `wer`, `char_distance`, `word_distance`,
`expected_char_count`, `expected_word_count`, `rating`, `normalization_summary` とす
る。
  - 比較前の正規化ルールは共通化する。
  - `\r\n` / `\r` を `\n` に統一する。
  - Unicode は `NFC` 正規化する。
  - 各行末の空白は除去する。
  - それ以外の改行崩れ、段落分割、本文中スペース差異は誤差として評価に含める。
  - 判定基準は `deepsearch.md` に合わせる。
  - `CER <= 0.02` は `Good`
  - `0.02 < CER < 0.10` は `Average`
  - `CER >= 0.10` は `Poor`

  ## Evaluation Method A: python-Levenshtein
  - `python-Levenshtein` を使って文字列全体の編集距離を計算する。
  - `char_distance` は正解文字列と予測文字列の編集距離を採用する。
  - `cer` は `char_distance / len(expected_chars)` で計算する。
  - `word_distance` は単語列に分解した上で別実装の編集距離関数で計算する。
  - `wer` は `word_distance / len(expected_words)` で計算する。
  - 日本語では主評価を `CER` とし、`WER` は補助情報として扱う。
  - `python-Levenshtein` 方式は、文字単位距離の高速計算と差分絶対量の把握を主目的にす
る。

  ## Evaluation Method B: jiwer
  - `jiwer` を使って `cer` と `wer` を算出する。
  - `jiwer` 側にも共通正規化済み文字列を渡し、両方式で入力条件を一致させる。
  - `char_distance` は `cer * len(expected_chars)` から整数化して整合性を保つか、必要に
応じて補助的に別途計算する。
  - `word_distance` は `wer * len(expected_words)` の近似値ではなく、実装上は必要なら追
加計算して明示する。
  - `jiwer` 方式は、OCR評価ライブラリとしての標準的な `CER/WER` 算出を主目的にする。

  ## Public Interfaces / Behavior
  - 共通 dataclass を用意する。
  - 例: `OcrEvaluationResult`
  - 共通関数を用意する。
  - 例: `evaluate_with_levenshtein(expected: str, actual: str) -> OcrEvaluationResult`
  - 例: `evaluate_with_jiwer(expected: str, actual: str) -> OcrEvaluationResult`
  - 比較対象データは pytest から渡す。
  - 今回は API エンドポイント追加は行わない。
  - pytest 中心の仕組みにし、必要なら将来 CLI に流用できるよう純粋関数として実装する。

  ## Dataset Handling
  - `testsdata` の比較対象は複数ペア追加を前提にした定義にする。
  - 初期データセットは `expect_提出用 1.md` を期待値として使う。
  - OCR結果ファイルは、実在ファイル名をそのまま使う。
  - 現状の実ファイルは `testsdata/result_ndlorc_提出用 1md` なので、初期実装はこの実在
パスを参照する。
  - 将来的には `expect_*` と `result_*` の対応表を増やせる形にする。

  ## Test Plan
  - 共通正規化テスト
  - 改行コード差分だけなら同一結果になる
  - 行末空白だけなら同一結果になる
  - Unicode正規化対象だけなら同一結果になる
  - `python-Levenshtein` 方式テスト
  - 完全一致で `CER=0`, `WER=0`, `char_distance=0`
  - 置換、挿入、削除を含む短文で `char_distance` と `CER` が正しい
  - `jiwer` 方式テスト
  - 完全一致で `CER=0`, `WER=0`
  - 簡単な英語文で `WER` が想定通りになる
  - データセットテスト
  - 今回の `testsdata/expect_提出用 1.md` と OCR結果ファイルを、両方式で評価できる
  - テスト失敗時メッセージに `method`, `CER`, `WER`, `rating` を含める
  - 実行コマンドは `python -m pytest tests -k ocr_eval`
  - `backendapp/requirements.txt` に `python-Levenshtein` を追加する
  - 依存追加後、pytest が両ライブラリを import できることを確認する

  ## Assumptions
  - 日本語OCR評価の主判断は `CER` とする。
  - `WER` は日本語では補助指標として扱う。
  - Markdown 構造差分を吸収する高度な段落再整形は行わない。
  - 実在する OCR結果ファイル名がユーザー記載と異なるため、初期実装では実ファイル名を優
先する。
  - 初版は評価値を安定算出できることを優先し、合格閾値による pass/fail 運用は後から
dataset 単位で追加可能にする。

  ## Assumptions

  - 出力先ファイルは evaluation/ を配下に出力する。
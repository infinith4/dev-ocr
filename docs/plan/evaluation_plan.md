 # docs/ocr-evaluation-plan.md として出力する計画

  ## Summary
  
  deepsearch.md に基づく OCR 評価仕組みの 実装計画を Markdown で保存する。評価は pytest ベース、主指標は CER、補助指標は WER
  と Levenshtein距離 とする。

  # OCR評価仕組み追加計画

  ## Summary
  `deepsearch.md` に合わせて、OCR結果を Ground Truth と比較する pytest ベースの評価仕組
みを追加する。主指標は日本語向けの CER、補助指標として WER と Levenshtein距離を出し、
Good / Average / Poor の判定も返す。実装は今回の 1 ペアで動きつつ、`testsdata` に比較対
象を増やせる形にする。

  ## Key Changes
  - `backendapp` か `tests` から再利用できる純粋関数の評価モジュールを追加する。
  - 入力は `expected_text`, `actual_text`、出力は `cer`, `wer`, `char_distance`,
`word_distance`, `expected_char_count`, `expected_word_count`, `rating`,
`normalization_summary` とする。
  - 文字列比較は標準ライブラリのみで完結させる。Levenshtein距離は文字単位と単語単位で内
部計算する。
  - 正規化ルールは最小限に固定する。
  - `\r\n` / `\r` を `\n` に統一する。
  - Unicode は `NFC` 正規化する。
  - 各行末の空白は除去する。
  - それ以外の改行崩れ、段落分割、本文中スペース差異は誤差として評価に含める。
  - 判定基準は `deepsearch.md` の表に合わせる。
  - `CER <= 0.02` は `Good`
  - `0.02 < CER < 0.10` は `Average`
  - `CER >= 0.10` は `Poor`
  - pytest 側にデータセット定義を追加する。
  - 比較ペアは `testsdata` のファイルパスを列挙する形で開始する。
  - 今回は `expect_提出用 1.md` を期待値として使う。
  - 実ファイル名は現状 `testsdata/result_ndlorc_提出用 1md` なので、テスト定義ではこの
実在パスを参照する。
  - テスト出力は失敗時に評価値が見えるようにする。
  - `assert` メッセージに `CER/WER/距離/判定` を含める。
  - しきい値は最初は緩めに固定せず、まずは計測できることを主目的にする。
  - 必要なら `CER` の上限しきい値を dataset ごとに持てる構造にする。

  ## Public Interfaces / Behavior
  - 追加する主インターフェースは pytest 用の評価ヘルパー関数とする。
  - 例: `evaluate_ocr_text(expected: str, actual: str) -> OcrEvaluationResult`
  - `OcrEvaluationResult` は dataclass で保持する。
  - 将来 CLI/API に流用しやすい形にする。
  - 今回は API エンドポイントは追加しない。
  - 今回は外部依存は増やさない。
  - `jiwer` 等の導入は避け、再現性とセットアップ負荷を優先する。

  ## Test Plan
  - 完全一致で `CER=0`, `WER=0`, `distance=0`, `rating=Good`
  - 置換・挿入・削除を含む短文で距離計算が正しい
  - 正規化対象の差分だけなら評価値が変わらない
  - 日本語文で空白や改行の差異が `CER` に反映される
め、初期実装はその実ファイル名に合わせる。
  - 初版は評価を計算して継続利用できる仕組みを優先し、合格基準の厳密な閾値運用は
dataset ごとの設定に後から拡張できる形に留める。

  ## Assumptions

  - 出力先ファイルは evaluation/ を配下に出力する。
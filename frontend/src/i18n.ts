export type Locale = "en-us" | "ja-jp";

export const SUPPORTED_LOCALES: Locale[] = ["en-us", "ja-jp"];

export const messages = {
  "en-us": {
    app: {
      title: "OCR - Text Extraction",
      subtitle: "Upload a PDF or image to extract text",
      unknownError: "Unknown error",
      languageLabel: "Language",
    },
    upload: {
      processingPage: "Processing page {current} / {total}...",
      processing: "OCR processing...",
      changeFile: "Click or drop to change file",
      dropPrompt: "Click or drag & drop a file here",
      formats: "PDF, JPG, PNG, TIFF, BMP",
      start: "OCR Start",
      running: "Processing...",
    },
    result: {
      title: "OCR Result",
      linesDetected: "{count} lines detected",
      download: "Download .md",
      copy: "Copy",
      copied: "Copied!",
      allPages: "All Pages",
      page: "Page {page}",
      noText: "(No text detected)",
      comparisonTitle: "Engine Comparison",
      comparisonDescription: "Switch engines above and compare both OCR outputs side by side for the same file.",
      noTextOnPage: "(No text detected on this page)",
      lines: "{count} lines",
    },
    evaluation: {
      title: "OCR Evaluation",
      subtitle: "Compare OCR text with a ground-truth Markdown file. CER is the primary metric for Japanese text.",
      replaceExpected: "Click to replace the expected Markdown file",
      selectExpected: "Select expected Markdown",
      expectedHint: "Upload a UTF-8 `.md` or `.txt` file as ground truth",
      running: "Evaluating...",
      run: "Run Evaluation",
      waiting: "OCR result will appear here after you process a file.",
      normalization: "Normalization: {summary}. WER is shown as a secondary reference.",
      guideTitle: "How to read these metrics",
      cerDescription: "Character Error Rate. Based on Levenshtein edit distance using substitutions, insertions, and deletions divided by the total number of ground-truth characters. For Japanese text, this is the primary metric.",
      werDescription: "Word Error Rate. The same idea applied at word level. It is useful as a secondary reference, but for Japanese it is less reliable than CER because word boundaries are less explicit.",
      levenshteinLabel: "Levenshtein distance",
      levenshteinDescription: "Absolute edit count between OCR output and ground truth. Char distance counts character edits and word distance counts token edits.",
      ratingDescription: "Based on CER from deepsearch.md: Good is about 1-2%, Average is 2-10%, Poor is 10% or more.",
      charDistance: "Char distance",
      wordDistance: "Word distance",
      expectedChars: "Expected chars",
      expectedWords: "Expected words",
      rating: "Rating",
    },
    common: {
      cer: "CER",
      wer: "WER",
      good: "Good",
      average: "Average",
      poor: "Poor",
      english: "English",
      japanese: "日本語",
    },
  },
  "ja-jp": {
    app: {
      title: "OCR テキスト抽出",
      subtitle: "PDF や画像をアップロードして文字を抽出します",
      unknownError: "不明なエラーが発生しました",
      languageLabel: "言語",
    },
    upload: {
      processingPage: "{current} / {total} ページを処理中...",
      processing: "OCR を処理中...",
      changeFile: "クリックまたはドラッグ&ドロップでファイルを変更",
      dropPrompt: "ここをクリック、またはファイルをドラッグ&ドロップ",
      formats: "PDF, JPG, PNG, TIFF, BMP",
      start: "OCR 実行",
      running: "処理中...",
    },
    result: {
      title: "OCR 結果",
      linesDetected: "{count} 行を検出",
      download: "Markdown をダウンロード",
      copy: "コピー",
      copied: "コピーしました",
      allPages: "全ページ",
      page: "{page} ページ",
      noText: "（テキストは検出されませんでした）",
      comparisonTitle: "エンジン比較",
      comparisonDescription: "上のエンジンを切り替えながら、同じファイルに対する OCR 結果を左右で比較できます。",
      noTextOnPage: "（このページではテキストが検出されませんでした）",
      lines: "{count} 行",
    },
    evaluation: {
      title: "OCR 評価",
      subtitle: "OCR 結果と正解 Markdown を比較します。日本語では CER を主指標として確認します。",
      replaceExpected: "クリックして期待値 Markdown を差し替え",
      selectExpected: "期待値 Markdown を選択",
      expectedHint: "正解データとして UTF-8 の `.md` または `.txt` をアップロードしてください",
      running: "評価中...",
      run: "評価を実行",
      waiting: "OCR を実行すると、ここに評価結果を表示できます。",
      normalization: "正規化: {summary}。WER は補助指標として表示しています。",
      guideTitle: "指標の見方",
      cerDescription: "文字誤り率です。置換・挿入・削除の最小編集回数を正解文字数で割ったもので、日本語 OCR では主指標として扱います。",
      werDescription: "単語誤り率です。CER と同じ考え方を単語単位に適用したもので、英語では有効ですが、日本語では CER より補助的な指標です。",
      levenshteinLabel: "Levenshtein 距離",
      levenshteinDescription: "OCR 結果と正解の差を編集回数の絶対値で表したものです。Char distance は文字単位、Word distance は単語単位の差です。",
      ratingDescription: "deepsearch.md の CER 基準に基づきます。Good は約 1〜2%、Average は 2〜10%、Poor は 10%以上です。",
      charDistance: "文字距離",
      wordDistance: "単語距離",
      expectedChars: "正解文字数",
      expectedWords: "正解単語数",
      rating: "評価",
    },
    common: {
      cer: "CER",
      wer: "WER",
      good: "Good",
      average: "Average",
      poor: "Poor",
      english: "English",
      japanese: "日本語",
    },
  },
} as const;

export type Messages = (typeof messages)[Locale];

export function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return SUPPORTED_LOCALES.find((locale) => locale === segment) ?? null;
}

export function getPreferredLocale(languages: readonly string[]): Locale {
  const preferred = languages.find(Boolean)?.toLowerCase() ?? "";
  return preferred.startsWith("ja") ? "ja-jp" : "en-us";
}

export function localizePath(locale: Locale, pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const rest = getLocaleFromPath(pathname) ? segments.slice(1) : segments;
  return `/${[locale, ...rest].join("/")}`.replace(/\/+$/, "") || `/${locale}`;
}

export function ensureLocalePath(): Locale {
  const locale = getLocaleFromPath(window.location.pathname);
  if (locale) {
    return locale;
  }

  const preferredLocale = getPreferredLocale(navigator.languages);
  const localizedPath = localizePath(preferredLocale, window.location.pathname);
  window.history.replaceState({}, "", `${localizedPath}${window.location.search}${window.location.hash}`);
  return preferredLocale;
}

export function translate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

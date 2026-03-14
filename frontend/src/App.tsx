import { useCallback, useEffect, useState } from "react";
import type {
  OcrEngineType,
  OcrEvaluationResponse,
  OcrProgress,
  OcrResponse,
} from "./api/ocr";
import { evaluateOcrResult, runOcr } from "./api/ocr";
import EvaluationPanel from "./components/EvaluationPanel";
import FileUpload from "./components/FileUpload";
import OcrResult from "./components/OcrResult";
import "./App.css";
import { getLocaleFromPath, localizePath, messages, type Locale } from "./i18n";

type OcrResultsByEngine = Partial<Record<OcrEngineType, OcrResponse>>;

function App() {
  const [locale, setLocale] = useState<Locale>(() => getLocaleFromPath(window.location.pathname) ?? "en-us");
  const [loading, setLoading] = useState(false);
  const [resultsByEngine, setResultsByEngine] = useState<OcrResultsByEngine>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [engine, setEngine] = useState<OcrEngineType>("paddleocr");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<OcrEvaluationResponse | null>(null);
  const t = messages[locale];

  useEffect(() => {
    const handlePopState = () => {
      setLocale(getLocaleFromPath(window.location.pathname) ?? "en-us");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setFilename(file.name);
    setError(null);
    setResultsByEngine({});
    setEvaluationError(null);
    setEvaluationResult(null);
  }, []);

  const handleStartOcr = useCallback(async () => {
    if (!selectedFile) return;
    const file = selectedFile;
    setLoading(true);
    setError(null);
    setProgress(null);
    setEvaluationError(null);
    setEvaluationResult(null);
    try {
      const res = await runOcr(file, setProgress, engine);
      setResultsByEngine((current) => ({ ...current, [engine]: res }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.app.unknownError);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [engine, selectedFile, t.app.unknownError]);

  const handleExpectedFileChange = useCallback(() => {
    setEvaluationError(null);
    setEvaluationResult(null);
  }, []);

  const handleEngineChange = useCallback((nextEngine: OcrEngineType) => {
    setEngine(nextEngine);
    setEvaluationError(null);
    setEvaluationResult(null);
  }, []);

  const handleEvaluate = useCallback(async (expectedFile: File) => {
    const result = resultsByEngine[engine];
    if (!result) return;
    setEvaluationLoading(true);
    setEvaluationError(null);
    setEvaluationResult(null);
    try {
      const evaluation = await evaluateOcrResult(expectedFile, result.text);
      setEvaluationResult(evaluation);
    } catch (e) {
      setEvaluationError(e instanceof Error ? e.message : t.app.unknownError);
    } finally {
      setEvaluationLoading(false);
    }
  }, [engine, resultsByEngine, t.app.unknownError]);

  const activeResult = resultsByEngine[engine] ?? null;

  const handleLocaleChange = useCallback((nextLocale: Locale) => {
    const nextPath = localizePath(nextLocale, window.location.pathname);
    window.history.pushState({}, "", `${nextPath}${window.location.search}${window.location.hash}`);
    setLocale(nextLocale);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="locale-switcher" aria-label={t.app.languageLabel}>
          <button
            className={`locale-btn ${locale === "ja-jp" ? "active" : ""}`}
            onClick={() => handleLocaleChange("ja-jp")}
            type="button"
          >
            {t.common.japanese}
          </button>
          <button
            className={`locale-btn ${locale === "en-us" ? "active" : ""}`}
            onClick={() => handleLocaleChange("en-us")}
            type="button"
          >
            {t.common.english}
          </button>
        </div>
        <h1>{t.app.title}</h1>
        <p>{t.app.subtitle}</p>
        <div className="engine-toggle">
          <button
            className={`engine-btn ${engine === "paddleocr" ? "active" : ""}`}
            onClick={() => handleEngineChange("paddleocr")}
            disabled={loading}
          >
            PaddleOCR
          </button>
          <button
            className={`engine-btn ${engine === "ndlocr" ? "active" : ""}`}
            onClick={() => handleEngineChange("ndlocr")}
            disabled={loading}
          >
            ndlocr-lite
          </button>
        </div>
      </header>

      <main className="app-main">
        <FileUpload
          onFileSelect={handleFileSelect}
          onStartOcr={handleStartOcr}
          loading={loading}
          hasFile={selectedFile !== null}
          progress={progress}
          messages={t.upload}
        />

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {(resultsByEngine.paddleocr || resultsByEngine.ndlocr) && (
          <OcrResult
            activeEngine={engine}
            resultsByEngine={resultsByEngine}
            filename={filename}
            messages={t.result}
          />
        )}
        <EvaluationPanel
          result={activeResult}
          evaluationResult={evaluationResult}
          evaluationLoading={evaluationLoading}
          evaluationError={evaluationError}
          onEvaluate={handleEvaluate}
          onExpectedFileChange={handleExpectedFileChange}
          messages={t.evaluation}
          common={t.common}
        />
      </main>
    </div>
  );
}

export default App;

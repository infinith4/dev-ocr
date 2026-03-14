import { useCallback, useState } from "react";
import type { OcrEngineType, OcrProgress, OcrResponse } from "./api/ocr";
import { runOcr } from "./api/ocr";
import FileUpload from "./components/FileUpload";
import OcrResult from "./components/OcrResult";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [engine, setEngine] = useState<OcrEngineType>("paddleocr");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setFilename(file.name);
    setError(null);
    setResult(null);
  }, []);

  const handleStartOcr = useCallback(async () => {
    if (!selectedFile) return;
    const file = selectedFile;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await runOcr(file, setProgress, engine);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [engine, selectedFile]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>OCR - Text Extraction</h1>
        <p>Upload a PDF or image to extract text</p>
        <div className="engine-toggle">
          <button
            className={`engine-btn ${engine === "paddleocr" ? "active" : ""}`}
            onClick={() => setEngine("paddleocr")}
            disabled={loading}
          >
            PaddleOCR
          </button>
          <button
            className={`engine-btn ${engine === "ndlocr" ? "active" : ""}`}
            onClick={() => setEngine("ndlocr")}
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
        />

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {result && <OcrResult result={result} filename={filename} />}
      </main>
    </div>
  );
}

export default App;

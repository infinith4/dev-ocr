import { useCallback, useState } from "react";
import type { OcrResponse } from "./api/ocr";
import { runOcr } from "./api/ocr";
import FileUpload from "./components/FileUpload";
import OcrResult from "./components/OcrResult";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runOcr(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>OCR - Text Extraction</h1>
        <p>Upload a PDF or image to extract text using ndlocr-lite</p>
      </header>

      <main className="app-main">
        <FileUpload onFileSelect={handleFileSelect} loading={loading} />

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {result && <OcrResult result={result} />}
      </main>
    </div>
  );
}

export default App;

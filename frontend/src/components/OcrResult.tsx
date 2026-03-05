import { useState } from "react";
import type { OcrResponse } from "../api/ocr";

interface OcrResultProps {
  result: OcrResponse;
}

export default function OcrResult({ result }: OcrResultProps) {
  const [activeTab, setActiveTab] = useState<"all" | number>("all");
  const [copied, setCopied] = useState(false);

  const displayText =
    activeTab === "all"
      ? result.text
      : result.pages[activeTab]?.text || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="result-container">
      <div className="result-header">
        <h2>OCR Result</h2>
        <span className="line-count">{result.total_lines} lines detected</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {result.pages.length > 1 && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Pages
          </button>
          {result.pages.map((page) => (
            <button
              key={page.page}
              className={`tab ${activeTab === page.page - 1 ? "active" : ""}`}
              onClick={() => setActiveTab(page.page - 1)}
            >
              Page {page.page}
            </button>
          ))}
        </div>
      )}

      <pre className="result-text">{displayText || "(No text detected)"}</pre>
    </div>
  );
}

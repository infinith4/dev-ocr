import { useState } from "react";
import type { OcrResponse } from "../api/ocr";

interface OcrResultProps {
  result: OcrResponse;
  filename: string;
}

function toMarkdown(result: OcrResponse, filename: string): string {
  if (result.pages.length <= 1) {
    return `${result.text}\n`;
  }

  const sections = result.pages
    .map((page) => `## Page ${page.page}\n\n${page.text}`)
    .join("\n\n");

  return `# OCR Result: ${filename}\n\n${sections}\n`;
}

function toMarkdownFilename(filename: string): string {
  return filename.includes(".")
    ? filename.replace(/\.[^.]+$/, ".md")
    : `${filename || "ocr-result"}.md`;
}

export default function OcrResult({ result, filename }: OcrResultProps) {
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

  const handleDownloadMarkdown = () => {
    const markdown = toMarkdown(result, filename);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = toMarkdownFilename(filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="result-container">
      <div className="result-header">
        <h2>OCR Result</h2>
        <span className="line-count">{result.total_lines} lines detected</span>
        <div className="result-actions">
          <button className="secondary-btn" onClick={handleDownloadMarkdown}>
            Download .md
          </button>
          <button className="secondary-btn" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
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

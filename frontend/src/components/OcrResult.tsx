import { useState } from "react";
import type { OcrEngineType, OcrResponse } from "../api/ocr";
import type { Messages } from "../i18n";
import { translate } from "../i18n";

interface OcrResultProps {
  activeEngine: OcrEngineType;
  resultsByEngine: Partial<Record<OcrEngineType, OcrResponse>>;
  filename: string;
  messages: Messages["result"];
}

const ENGINE_LABELS: Record<OcrEngineType, string> = {
  paddleocr: "PaddleOCR",
  ndlocr: "ndlocr-lite",
};

function toMarkdown(result: OcrResponse, filename: string, messages: Messages["result"]): string {
  if (result.pages.length <= 1) {
    return `${result.text}\n`;
  }

  const sections = result.pages
    .map((page) => `## ${translate(messages.page, { page: page.page })}\n\n${page.text}`)
    .join("\n\n");

  return `# ${messages.title}: ${filename}\n\n${sections}\n`;
}

function toMarkdownFilename(filename: string): string {
  return filename.includes(".")
    ? filename.replace(/\.[^.]+$/, ".md")
    : `${filename || "ocr-result"}.md`;
}

export default function OcrResult({ activeEngine, resultsByEngine, filename, messages }: OcrResultProps) {
  const result = resultsByEngine[activeEngine] ?? null;
  const [activeTab, setActiveTab] = useState<"all" | number>("all");
  const [copied, setCopied] = useState(false);

  if (!result) {
    return null;
  }

  const displayText =
    activeTab === "all"
      ? result.text
      : result.pages[activeTab]?.text || "";

  const compareEngines = (["paddleocr", "ndlocr"] as const).filter(
    (engine) => resultsByEngine[engine],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const markdown = toMarkdown(result, filename, messages);
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
        <h2>{messages.title}</h2>
        <span className="engine-badge">{ENGINE_LABELS[activeEngine]}</span>
        <span className="line-count">{translate(messages.linesDetected, { count: result.total_lines })}</span>
        <div className="result-actions">
          <button className="secondary-btn" onClick={handleDownloadMarkdown}>
            {messages.download}
          </button>
          <button className="secondary-btn" onClick={handleCopy}>
            {copied ? messages.copied : messages.copy}
          </button>
        </div>
      </div>

      {result.pages.length > 1 && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            {messages.allPages}
          </button>
          {result.pages.map((page) => (
            <button
              key={page.page}
              className={`tab ${activeTab === page.page - 1 ? "active" : ""}`}
              onClick={() => setActiveTab(page.page - 1)}
            >
              {translate(messages.page, { page: page.page })}
            </button>
          ))}
        </div>
      )}

      <pre className="result-text">{displayText || messages.noText}</pre>

      {compareEngines.length === 2 && (
        <div className="comparison-section">
          <div className="comparison-header">
            <h3>{messages.comparisonTitle}</h3>
            <p>{messages.comparisonDescription}</p>
          </div>
          <div className="comparison-grid">
            {compareEngines.map((engine) => {
              const engineResult = resultsByEngine[engine]!;
              const engineText =
                activeTab === "all"
                  ? engineResult.text
                  : engineResult.pages[activeTab]?.text || messages.noTextOnPage;

              return (
                <article key={engine} className="comparison-card">
                  <div className="comparison-card-header">
                    <h4>{ENGINE_LABELS[engine]}</h4>
                    <span>{translate(messages.lines, { count: engineResult.total_lines })}</span>
                  </div>
                  <pre className="comparison-text">{engineText || messages.noText}</pre>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

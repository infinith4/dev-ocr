import { useCallback, useRef, useState } from "react";
import type { OcrEvaluationResponse, OcrResponse } from "../api/ocr";
import type { Messages } from "../i18n";
import { translate } from "../i18n";

interface EvaluationPanelProps {
  result: OcrResponse | null;
  evaluationResult: OcrEvaluationResponse | null;
  evaluationLoading: boolean;
  evaluationError: string | null;
  onEvaluate: (expectedFile: File) => Promise<void>;
  onExpectedFileChange: () => void;
  messages: Messages["evaluation"];
  common: Messages["common"];
}

const ACCEPTED = ".md,.txt,text/markdown,text/plain";

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function translateRating(rating: string, common: Messages["common"]): string {
  switch (rating.toLowerCase()) {
    case "good":
      return common.good;
    case "average":
      return common.average;
    case "poor":
      return common.poor;
    default:
      return rating;
  }
}

export default function EvaluationPanel({
  result,
  evaluationResult,
  evaluationLoading,
  evaluationError,
  onEvaluate,
  onExpectedFileChange,
  messages,
  common,
}: EvaluationPanelProps) {
  const [expectedFile, setExpectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File | null) => {
    setExpectedFile(file);
    onExpectedFileChange();
  }, [onExpectedFileChange]);

  const handlePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event.target.files?.[0] ?? null);
  }, [handleFileChange]);

  const handleRun = useCallback(async () => {
    if (!expectedFile) return;
    await onEvaluate(expectedFile);
  }, [expectedFile, onEvaluate]);

  const canEvaluate = Boolean(result && expectedFile && !evaluationLoading);

  return (
    <section className="evaluation-section">
      <div className="evaluation-header">
        <div>
          <h2>{messages.title}</h2>
          <p>{messages.subtitle}</p>
        </div>
      </div>

      <div className="evaluation-controls">
        <div
          className="expected-file-box"
          onClick={() => !evaluationLoading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            onChange={handlePick}
            hidden
          />
          {expectedFile ? (
            <>
              <p className="file-name">{expectedFile.name}</p>
              <p className="hint">{messages.replaceExpected}</p>
            </>
          ) : (
            <>
              <p className="file-name">{messages.selectExpected}</p>
              <p className="hint">{messages.expectedHint}</p>
            </>
          )}
        </div>
        <button
          className="start-ocr-btn"
          disabled={!canEvaluate}
          onClick={handleRun}
        >
          {evaluationLoading ? messages.running : messages.run}
        </button>
      </div>

      {!result && (
        <div className="evaluation-note">
          {messages.waiting}
        </div>
      )}

      {evaluationError && (
        <div className="error">
          <p>{evaluationError}</p>
        </div>
      )}

      {evaluationResult && (
        <div className="evaluation-results">
          <p className="evaluation-summary">
            {translate(messages.normalization, { summary: evaluationResult.normalization_summary })}
          </p>
          <div className="evaluation-guide">
            <h3>{messages.guideTitle}</h3>
            <dl className="evaluation-guide-list">
              <div>
                <dt>{common.cer}</dt>
                <dd>{messages.cerDescription}</dd>
              </div>
              <div>
                <dt>{common.wer}</dt>
                <dd>{messages.werDescription}</dd>
              </div>
              <div>
                <dt>{messages.levenshteinLabel}</dt>
                <dd>{messages.levenshteinDescription}</dd>
              </div>
              <div>
                <dt>{messages.rating}</dt>
                <dd>{messages.ratingDescription}</dd>
              </div>
            </dl>
          </div>
          <div className="evaluation-grid">
            {evaluationResult.results.map((methodResult) => (
              <article key={methodResult.method} className="evaluation-card">
                <div className="evaluation-card-header">
                  <h3>{methodResult.method}</h3>
                  <span className={`rating-pill rating-${methodResult.rating.toLowerCase()}`}>
                    {translateRating(methodResult.rating, common)}
                  </span>
                </div>
                <dl className="metric-list">
                  <div>
                    <dt>{common.cer}</dt>
                    <dd>{formatRate(methodResult.cer)}</dd>
                  </div>
                  <div>
                    <dt>{common.wer}</dt>
                    <dd>{formatRate(methodResult.wer)}</dd>
                  </div>
                  <div>
                    <dt>{messages.charDistance}</dt>
                    <dd>{methodResult.char_distance}</dd>
                  </div>
                  <div>
                    <dt>{messages.wordDistance}</dt>
                    <dd>{methodResult.word_distance}</dd>
                  </div>
                  <div>
                    <dt>{messages.expectedChars}</dt>
                    <dd>{methodResult.expected_char_count}</dd>
                  </div>
                  <div>
                    <dt>{messages.expectedWords}</dt>
                    <dd>{methodResult.expected_word_count}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

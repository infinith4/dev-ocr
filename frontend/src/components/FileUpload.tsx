import { useCallback, useRef, useState } from "react";
import type { OcrProgress } from "../api/ocr";
import type { Messages } from "../i18n";
import { translate } from "../i18n";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onStartOcr: () => void;
  loading: boolean;
  hasFile: boolean;
  progress?: OcrProgress | null;
  messages: Messages["upload"];
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.tiff,.tif,.jp2,.bmp";

export default function FileUpload({
  onFileSelect,
  onStartOcr,
  loading,
  hasFile,
  progress,
  messages,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-section">
      <div
        className={`upload-area ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleChange}
          style={{ display: "none" }}
        />
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            {progress && progress.total > 0 ? (
              <>
                <p>{translate(messages.processingPage, { current: progress.current, total: progress.total })}</p>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <p>{messages.processing}</p>
            )}
          </div>
        ) : selectedFile ? (
          <div className="file-info">
            <p className="file-name">{selectedFile.name}</p>
            <p className="file-size">{formatSize(selectedFile.size)}</p>
            <p className="hint">{messages.changeFile}</p>
          </div>
        ) : (
          <div className="placeholder">
            <p className="upload-icon">+</p>
            <p>{messages.dropPrompt}</p>
            <p className="hint">{messages.formats}</p>
          </div>
        )}
      </div>
      <button
        className="start-ocr-btn"
        onClick={onStartOcr}
        disabled={!hasFile || loading}
      >
        {loading ? messages.running : messages.start}
      </button>
    </div>
  );
}

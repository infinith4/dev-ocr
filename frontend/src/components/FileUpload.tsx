import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.tiff,.tif,.jp2,.bmp";

export default function FileUpload({ onFileSelect, loading }: FileUploadProps) {
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
    <div
      className={`upload-area ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
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
          <p>OCR processing...</p>
        </div>
      ) : selectedFile ? (
        <div className="file-info">
          <p className="file-name">{selectedFile.name}</p>
          <p className="file-size">{formatSize(selectedFile.size)}</p>
          <p className="hint">Click or drop to change file</p>
        </div>
      ) : (
        <div className="placeholder">
          <p className="upload-icon">+</p>
          <p>Click or drag & drop a file here</p>
          <p className="hint">PDF, JPG, PNG, TIFF, BMP</p>
        </div>
      )}
    </div>
  );
}

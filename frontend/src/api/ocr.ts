export interface OcrPage {
  page: number;
  text: string;
  line_count: number;
}

export interface OcrResponse {
  text: string;
  pages: OcrPage[];
  total_lines: number;
}

export async function runOcr(file: File): Promise<OcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/ocr", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "OCR failed");
  }
  return res.json();
}

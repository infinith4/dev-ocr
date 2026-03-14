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

export interface OcrProgress {
  current: number;
  total: number;
}

type NdjsonEvent =
  | { event: "start"; total_pages: number }
  | { event: "page"; page: number; text: string; line_count: number }
  | { event: "done" }
  | { event: "error"; message: string };

export type OcrEngineType = "paddleocr" | "ndlocr";

export async function runOcr(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  engine: OcrEngineType = "paddleocr",
): Promise<OcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ engine });
  const res = await fetch(`/api/ocr?${params}`, { method: "POST", body: formData });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "OCR failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalPages = 0;
  const pages: OcrPage[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.trim()) continue;
      const event: NdjsonEvent = JSON.parse(line);

      switch (event.event) {
        case "start":
          totalPages = event.total_pages;
          onProgress?.({ current: 0, total: totalPages });
          break;
        case "page":
          pages.push({
            page: event.page,
            text: event.text,
            line_count: event.line_count,
          });
          onProgress?.({ current: event.page, total: totalPages });
          break;
        case "error":
          throw new Error(event.message);
        case "done":
          break;
      }
    }
  }

  const text = pages.map((p) => p.text).join("\n\n");
  const total_lines = pages.reduce((sum, p) => sum + p.line_count, 0);
  return { text, pages, total_lines };
}

#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: ./scripts/ocr2md.sh input.pdf [output-dir|full-output.md]" >&2
  exit 1
fi

input_file=$1

if [[ ! -f "$input_file" ]]; then
  echo "Input file not found: $input_file" >&2
  exit 1
fi

base_name=$(basename "$input_file")
base_stem="${base_name%.*}"

if [[ $# -eq 2 && "$2" == *.md ]]; then
  full_output_file=$2
  output_dir="${2%.md}"
elif [[ $# -eq 2 ]]; then
  output_dir=$2
  full_output_file="${output_dir}/00-full.md"
else
  output_dir="${base_stem}"
  full_output_file="${output_dir}/00-full.md"
fi

api_base_url=${OCR_API_BASE_URL:-http://localhost:8000}
mkdir -p "$output_dir"
splitter_script=$(mktemp)

cat > "$splitter_script" <<'PY'
from __future__ import annotations

import pathlib
import re
import sys
from typing import TextIO


def is_page_heading(line: str) -> bool:
    return bool(re.match(r"^## Page \d+\s*$", line.strip()))


KANJI_TO_INT = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}


def normalize_number(raw: str) -> int | None:
    ascii_digits = raw.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    if ascii_digits.isdigit():
        return int(ascii_digits)
    return KANJI_TO_INT.get(raw)


def detect_bucket(line: str) -> str | None:
    stripped = line.strip()
    if not stripped:
        return None
    if stripped.startswith("# OCR Result:") or is_page_heading(line):
        return None

    chapter_match = re.match(r"^第([0-9０-９一二三四五六七八九十]+)章", stripped)
    if chapter_match:
        chapter_number = normalize_number(chapter_match.group(1))
        if chapter_number is not None:
            return f"{chapter_number + 1:02d}-chapter-{chapter_number:02d}"

    if stripped.startswith(("目次", "はじめに", "ガイド第2版の発行に際して")):
        return "01-toc"

    if stripped.startswith(("おわりに", "あとがき", "付録", "参考文献")):
        return "09-appendix"

    return None


def bucket_path(output_dir: pathlib.Path, bucket: str) -> pathlib.Path:
    if bucket == "01-toc":
        return output_dir / "01-toc.md"
    if bucket == "09-appendix":
        return output_dir / "09-appendix.md"
    if re.match(r"^\d{2}-chapter-\d{2}$", bucket):
        return output_dir / f"{bucket}.md"
    return output_dir / "99-misc.md"


class StreamingChapterWriter:
    def __init__(self, output_dir: pathlib.Path, full_output_file: pathlib.Path) -> None:
        self.output_dir = output_dir
        self.full_output_file = full_output_file
        self.full_fp = full_output_file.open("w", encoding="utf-8")
        self.section_fps: dict[str, TextIO] = {}
        self.created_paths: set[pathlib.Path] = set()
        self.current_bucket = "01-toc"
        self.pending_page_heading: str | None = None

    def close(self) -> None:
        for fp in self.section_fps.values():
            fp.close()
        self.full_fp.close()

    def get_section_fp(self, bucket: str) -> TextIO:
        fp = self.section_fps.get(bucket)
        if fp is not None:
            return fp

        path = bucket_path(self.output_dir, bucket)
        fp = path.open("w", encoding="utf-8")
        self.section_fps[bucket] = fp
        if path not in self.created_paths:
            self.created_paths.add(path)
            print(path)
        return fp

    def write_to_current(self, line: str) -> None:
        if not line.strip() and self.pending_page_heading is not None:
            return

        fp = self.get_section_fp(self.current_bucket)
        if self.pending_page_heading is not None and line.strip():
            fp.write(self.pending_page_heading)
            self.pending_page_heading = None
        fp.write(line)
        fp.flush()

    def process_line(self, line: str) -> None:
        self.full_fp.write(line)
        self.full_fp.flush()

        stripped = line.strip()
        if stripped.startswith("# OCR Result:"):
            return

        if is_page_heading(line):
            self.pending_page_heading = line
            return

        bucket = detect_bucket(line)
        if bucket is not None:
            self.current_bucket = bucket

        self.write_to_current(line)

    def finalize(self) -> None:
        if self.pending_page_heading is not None:
            fp = self.get_section_fp(self.current_bucket)
            fp.write(self.pending_page_heading)
            fp.flush()
            self.pending_page_heading = None
        self.close()


output_dir = pathlib.Path(sys.argv[1])
full_output_file = pathlib.Path(sys.argv[2])
splitter = StreamingChapterWriter(output_dir, full_output_file)

try:
    for line in sys.stdin:
        splitter.process_line(line)
finally:
    splitter.finalize()

print(f"Saved full Markdown to {full_output_file}", file=sys.stderr)
print(f"Split files were written to {output_dir}", file=sys.stderr)
PY

trap 'rm -f "$splitter_script"' EXIT

curl --fail --silent --show-error --no-buffer \
  -X POST "${api_base_url}/ocr?format=markdown" \
  -F "file=@${input_file}" \
  | python3 "$splitter_script" "$output_dir" "$full_output_file"

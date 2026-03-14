"""Utilities for evaluating OCR output against ground truth."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import unicodedata


GOOD_CER_THRESHOLD = 0.02
AVERAGE_CER_THRESHOLD = 0.10


@dataclass(frozen=True)
class OcrEvaluationResult:
    method: str
    cer: float
    wer: float
    char_distance: int
    word_distance: int
    expected_char_count: int
    expected_word_count: int
    rating: str
    normalization_summary: str

    def to_dict(self) -> dict[str, str | float | int]:
        return {
            "method": self.method,
            "cer": self.cer,
            "wer": self.wer,
            "char_distance": self.char_distance,
            "word_distance": self.word_distance,
            "expected_char_count": self.expected_char_count,
            "expected_word_count": self.expected_word_count,
            "rating": self.rating,
            "normalization_summary": self.normalization_summary,
        }


def normalize_ocr_text(text: str) -> str:
    """Apply minimal normalization shared across all evaluation methods."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = unicodedata.normalize("NFC", normalized)
    lines = [line.rstrip() for line in normalized.split("\n")]
    return "\n".join(lines)


def evaluate_with_levenshtein(expected: str, actual: str) -> OcrEvaluationResult:
    """Evaluate OCR text using python-Levenshtein for CER."""
    from Levenshtein import distance as levenshtein_distance

    expected_norm = normalize_ocr_text(expected)
    actual_norm = normalize_ocr_text(actual)

    char_distance = levenshtein_distance(expected_norm, actual_norm)
    expected_char_count = len(expected_norm)
    cer = _safe_rate(char_distance, expected_char_count)

    expected_words = _word_tokens(expected_norm)
    actual_words = _word_tokens(actual_norm)
    word_distance = _sequence_distance(expected_words, actual_words)
    expected_word_count = len(expected_words)
    wer = _safe_rate(word_distance, expected_word_count)

    return OcrEvaluationResult(
        method="python-Levenshtein",
        cer=cer,
        wer=wer,
        char_distance=char_distance,
        word_distance=word_distance,
        expected_char_count=expected_char_count,
        expected_word_count=expected_word_count,
        rating=_cer_rating(cer),
        normalization_summary=_normalization_summary(),
    )


def evaluate_with_jiwer(expected: str, actual: str) -> OcrEvaluationResult:
    """Evaluate OCR text using jiwer for CER and WER."""
    from jiwer import cer as jiwer_cer
    from jiwer import wer as jiwer_wer

    expected_norm = normalize_ocr_text(expected)
    actual_norm = normalize_ocr_text(actual)

    expected_char_count = len(expected_norm)
    expected_words = _word_tokens(expected_norm)
    expected_word_count = len(expected_words)

    cer_value = jiwer_cer(expected_norm, actual_norm)
    wer_value = jiwer_wer(expected_norm, actual_norm)
    char_distance = round(cer_value * expected_char_count)
    word_distance = _sequence_distance(expected_words, _word_tokens(actual_norm))

    return OcrEvaluationResult(
        method="jiwer",
        cer=cer_value,
        wer=wer_value,
        char_distance=char_distance,
        word_distance=word_distance,
        expected_char_count=expected_char_count,
        expected_word_count=expected_word_count,
        rating=_cer_rating(cer_value),
        normalization_summary=_normalization_summary(),
    )


def evaluate_pair_with_levenshtein(expected_path: str | Path, actual_path: str | Path) -> OcrEvaluationResult:
    return evaluate_with_levenshtein(_read_text(expected_path), _read_text(actual_path))


def evaluate_pair_with_jiwer(expected_path: str | Path, actual_path: str | Path) -> OcrEvaluationResult:
    return evaluate_with_jiwer(_read_text(expected_path), _read_text(actual_path))


def evaluate_all_methods(expected: str, actual: str) -> list[OcrEvaluationResult]:
    return [
        evaluate_with_levenshtein(expected, actual),
        evaluate_with_jiwer(expected, actual),
    ]


def _read_text(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def _safe_rate(distance: int, expected_count: int) -> float:
    if expected_count == 0:
        return 0.0 if distance == 0 else 1.0
    return distance / expected_count


def _word_tokens(text: str) -> list[str]:
    return text.split()


def _sequence_distance(expected_tokens: list[str], actual_tokens: list[str]) -> int:
    rows = len(expected_tokens) + 1
    cols = len(actual_tokens) + 1
    dp = [[0] * cols for _ in range(rows)]

    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if expected_tokens[i - 1] == actual_tokens[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[-1][-1]


def _cer_rating(cer: float) -> str:
    if cer <= GOOD_CER_THRESHOLD:
        return "Good"
    if cer < AVERAGE_CER_THRESHOLD:
        return "Average"
    return "Poor"


def _normalization_summary() -> str:
    return "CRLF->LF, Unicode NFC, trailing whitespace stripped"

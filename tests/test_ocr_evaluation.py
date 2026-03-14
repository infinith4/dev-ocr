"""Tests for OCR evaluation helpers."""

from pathlib import Path

import pytest

from backendapp.ocr_evaluation import (
    evaluate_pair_with_jiwer,
    evaluate_pair_with_levenshtein,
    evaluate_with_jiwer,
    evaluate_with_levenshtein,
    normalize_ocr_text,
)


DATASET_CASES = [
    (
        "ndlocr_sample_1",
        Path("testsdata/expect_提出用 1.md"),
        Path("testsdata/result_ndlorc_提出用 1md"),
    ),
]


def test_normalize_ocr_text_applies_minimal_rules():
    actual = "A\u0301 \r\nB  \rC\t \n"

    normalized = normalize_ocr_text(actual)

    assert normalized == "Á\nB\nC\n"


@pytest.mark.parametrize("evaluate", [evaluate_with_levenshtein, evaluate_with_jiwer])
def test_evaluate_exact_match(evaluate):
    result = evaluate("同じ文章です。", "同じ文章です。")

    assert result.cer == 0
    assert result.wer == 0
    assert result.char_distance == 0
    assert result.word_distance == 0
    assert result.rating == "Good"


def test_evaluate_with_levenshtein_reports_edit_distance():
    result = evaluate_with_levenshtein("abc", "adcX")

    assert result.char_distance == 2
    assert result.expected_char_count == 3
    assert result.cer == pytest.approx(2 / 3)
    assert result.rating == "Poor"


def test_evaluate_with_jiwer_reports_word_error_rate():
    result = evaluate_with_jiwer("alpha beta gamma", "alpha delta gamma")

    assert result.wer == pytest.approx(1 / 3)
    assert result.char_distance == 2
    assert result.word_distance == 1
    assert result.rating == "Poor"


@pytest.mark.parametrize(
    ("name", "expected_path", "actual_path"),
    DATASET_CASES,
)
def test_dataset_pair_can_be_evaluated_with_both_methods(name, expected_path, actual_path):
    lev_result = evaluate_pair_with_levenshtein(expected_path, actual_path)
    jiwer_result = evaluate_pair_with_jiwer(expected_path, actual_path)

    assert lev_result.expected_char_count > 0, _dataset_message(name, lev_result)
    assert jiwer_result.expected_char_count > 0, _dataset_message(name, jiwer_result)
    assert lev_result.cer == pytest.approx(jiwer_result.cer, abs=1e-3), _dataset_message(name, lev_result)
    assert lev_result.word_distance == jiwer_result.word_distance, _dataset_message(name, jiwer_result)


def _dataset_message(name, result) -> str:
    return (
        f"{name}: method={result.method}, CER={result.cer:.4f}, WER={result.wer:.4f}, "
        f"char_distance={result.char_distance}, word_distance={result.word_distance}, "
        f"rating={result.rating}"
    )

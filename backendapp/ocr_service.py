"""OCR Service supporting PaddleOCR and ndlocr-lite engines."""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
from PIL import Image


class BaseOCREngine(ABC):
    """OCR エンジンの共通インターフェース。"""

    @abstractmethod
    def initialize(self) -> None: ...

    @abstractmethod
    def ocr_image(self, pil_image: Image.Image) -> dict: ...


class PaddleOCREngine(BaseOCREngine):
    """PaddleOCR v3.4 ベースの OCR エンジン。"""

    def __init__(self) -> None:
        self._ocr = None
        self._initialized = False

    def initialize(self) -> None:
        import os

        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        from paddleocr import PaddleOCR

        self._ocr = PaddleOCR(
            lang="japan",
            use_textline_orientation=True,
        )
        self._initialized = True

    def ocr_image(self, pil_image: Image.Image) -> dict:
        if not self._initialized:
            raise RuntimeError("OCR engine not initialized. Call initialize() first.")

        img = np.array(pil_image.convert("RGB"))

        lines: list[str] = []
        for result in self._ocr.predict(img):
            texts = result.get("rec_texts") if hasattr(result, "get") else None
            if texts:
                lines.extend(texts)

        full_text = "\n".join(lines)
        return {
            "text": full_text,
            "line_count": len(lines),
            "lines": lines,
        }


class NdlocrEngine(BaseOCREngine):
    """ndlocr-lite ベースの OCR エンジン。"""

    def __init__(self) -> None:
        self._detector = None
        self._recognizer100 = None
        self._recognizer50 = None
        self._recognizer30 = None
        self._initialized = False

    def initialize(self) -> None:
        import xml.etree.ElementTree as ET  # noqa: F401
        from pathlib import Path

        from yaml import safe_load

        from deim import DEIM
        from parseq import PARSEQ

        import ocr as ocr_module

        base_dir = Path(ocr_module.__file__).resolve().parent

        det_weights = str(base_dir / "model" / "deim-s-1024x1024.onnx")
        det_classes = str(base_dir / "config" / "ndl.yaml")
        rec_classes = str(base_dir / "config" / "NDLmoji.yaml")
        rec_w100 = str(
            base_dir / "model" / "parseq-ndl-16x768-100-tiny-165epoch-tegaki2.onnx"
        )
        rec_w50 = str(
            base_dir / "model" / "parseq-ndl-16x384-50-tiny-146epoch-tegaki2.onnx"
        )
        rec_w30 = str(
            base_dir / "model" / "parseq-ndl-16x256-30-tiny-192epoch-tegaki3.onnx"
        )

        self._detector = DEIM(
            model_path=det_weights,
            class_mapping_path=det_classes,
            score_threshold=0.2,
            conf_threshold=0.25,
            iou_threshold=0.2,
            device="CPU",
        )

        with open(rec_classes, encoding="utf-8") as f:
            charobj = safe_load(f)
        charlist = list(charobj["model"]["charset_train"])

        self._recognizer100 = PARSEQ(
            model_path=rec_w100, charlist=charlist, device="CPU"
        )
        self._recognizer50 = PARSEQ(
            model_path=rec_w50, charlist=charlist, device="CPU"
        )
        self._recognizer30 = PARSEQ(
            model_path=rec_w30, charlist=charlist, device="CPU"
        )
        self._initialized = True

    def ocr_image(self, pil_image: Image.Image) -> dict:
        import xml.etree.ElementTree as ET

        if not self._initialized:
            raise RuntimeError("OCR engine not initialized. Call initialize() first.")

        from ndl_parser import convert_to_xml_string3
        from ocr import RecogLine, process_cascade
        from reading_order.xy_cut.eval import eval_xml

        img = np.array(pil_image.convert("RGB"))
        img_h, img_w = img.shape[:2]

        detections = self._detector.detect(img)
        classeslist = list(self._detector.classes.values())

        resultobj = [dict(), dict()]
        resultobj[0][0] = list()
        for i in range(17):
            resultobj[1][i] = []
        for det in detections:
            xmin, ymin, xmax, ymax = det["box"]
            conf = det["confidence"]
            if det["class_index"] == 0:
                resultobj[0][0].append([xmin, ymin, xmax, ymax])
            resultobj[1][det["class_index"]].append(
                [xmin, ymin, xmax, ymax, conf]
            )

        xmlstr = convert_to_xml_string3(
            img_w, img_h, "input.jpg", classeslist, resultobj
        )
        xmlstr = "<OCRDATASET>" + xmlstr + "</OCRDATASET>"
        root = ET.fromstring(xmlstr)
        eval_xml(root, logger=None)

        alllineobj: list = []
        tatelinecnt = 0
        alllinecnt = 0

        for idx, lineobj in enumerate(root.findall(".//LINE")):
            xmin_val = int(lineobj.get("X"))
            ymin_val = int(lineobj.get("Y"))
            line_w = int(lineobj.get("WIDTH"))
            line_h = int(lineobj.get("HEIGHT"))
            try:
                pred_char_cnt = float(lineobj.get("PRED_CHAR_CNT"))
            except (TypeError, ValueError):
                pred_char_cnt = 100.0
            if line_h > line_w:
                tatelinecnt += 1
            alllinecnt += 1
            lineimg = img[ymin_val : ymin_val + line_h, xmin_val : xmin_val + line_w, :]
            alllineobj.append(RecogLine(lineimg, idx, pred_char_cnt))

        if not alllineobj:
            return {"text": "", "line_count": 0, "lines": []}

        resultlinesall = process_cascade(
            alllineobj,
            self._recognizer30,
            self._recognizer50,
            self._recognizer100,
            is_cascade=True,
        )

        if alllinecnt > 0 and tatelinecnt / alllinecnt > 0.5:
            resultlinesall = resultlinesall[::-1]

        full_text = "\n".join(resultlinesall)
        return {
            "text": full_text,
            "line_count": len(resultlinesall),
            "lines": resultlinesall,
        }


# Module-level singletons (lazy-initialized)
_engines: dict[str, BaseOCREngine] = {}

AVAILABLE_ENGINES = ("paddleocr", "ndlocr")
DEFAULT_ENGINE = "paddleocr"


def get_engine(name: str) -> BaseOCREngine:
    """指定されたエンジンを取得（未初期化なら初期化）。"""
    if name not in AVAILABLE_ENGINES:
        raise ValueError(f"Unknown engine: {name}. Available: {AVAILABLE_ENGINES}")
    if name not in _engines:
        eng = PaddleOCREngine() if name == "paddleocr" else NdlocrEngine()
        eng.initialize()
        _engines[name] = eng
    return _engines[name]

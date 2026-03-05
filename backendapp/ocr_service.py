"""OCR Service wrapping ndlocr-lite for programmatic use."""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image
from yaml import safe_load


class OCREngine:
    """OCR engine that loads ndlocr-lite models once and processes images."""

    def __init__(self) -> None:
        self._detector = None
        self._recognizer100 = None
        self._recognizer50 = None
        self._recognizer30 = None
        self._initialized = False

    def initialize(self) -> None:
        """Load all ONNX models. Call once at app startup."""
        from deim import DEIM
        from parseq import PARSEQ

        # Resolve model/config paths from the installed ndlocr-lite package
        import ocr as ocr_module

        base_dir = Path(ocr_module.__file__).resolve().parent

        det_weights = str(base_dir / "model" / "deim-s-1024x1024.onnx")
        det_classes = str(base_dir / "config" / "ndl.yaml")
        rec_classes = str(base_dir / "config" / "NDLmoji.yaml")
        rec_w100 = str(
            base_dir
            / "model"
            / "parseq-ndl-16x768-100-tiny-165epoch-tegaki2.onnx"
        )
        rec_w50 = str(
            base_dir
            / "model"
            / "parseq-ndl-16x384-50-tiny-146epoch-tegaki2.onnx"
        )
        rec_w30 = str(
            base_dir
            / "model"
            / "parseq-ndl-16x256-30-tiny-192epoch-tegaki3.onnx"
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
        """Run OCR on a single PIL Image.

        Returns dict with keys: text, line_count, lines.
        """
        if not self._initialized:
            raise RuntimeError("OCR engine not initialized. Call initialize() first.")

        from ndl_parser import convert_to_xml_string3
        from ocr import RecogLine, process_cascade
        from reading_order.xy_cut.eval import eval_xml

        img = np.array(pil_image.convert("RGB"))
        img_h, img_w = img.shape[:2]

        # Detection
        detections = self._detector.detect(img)
        classeslist = list(self._detector.classes.values())

        # Build result structure for XML generation
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

        # Extract line images for recognition
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

        # Cascaded recognition (30→50→100 char models)
        resultlinesall = process_cascade(
            alllineobj,
            self._recognizer30,
            self._recognizer50,
            self._recognizer100,
            is_cascade=True,
        )

        # Reverse for vertical-dominant text (Japanese tategaki)
        if alllinecnt > 0 and tatelinecnt / alllinecnt > 0.5:
            resultlinesall = resultlinesall[::-1]

        full_text = "\n".join(resultlinesall)
        return {
            "text": full_text,
            "line_count": len(resultlinesall),
            "lines": resultlinesall,
        }


# Module-level singleton
engine = OCREngine()

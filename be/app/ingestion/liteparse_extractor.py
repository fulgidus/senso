"""
Text extraction via liteparse (@llamaindex/liteparse Python wrapper).

liteparse is a fast, local document parser that handles PDF, images, and
Office formats without making any LLM calls. It wraps the
@llamaindex/liteparse Node.js CLI and is the primary text-extraction step
before any LLM processing happens.

For PDFs it tries the embedded text layer first (ocr_enabled=False); if the
result is below OCR_CHAR_THRESHOLD it re-runs with ocr_enabled=True to handle
scanned pages. Images always run with OCR enabled.

Raises ImportError (caught at call site as a soft fallback signal) if the
liteparse package or its Node.js CLI is unavailable.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Supported image extensions that liteparse can handle via its OCR path.
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".gif"}


def extract_text_with_liteparse(
    file_path: Path,
    *,
    ocr_enabled: bool | None = None,
) -> str:
    """
    Extract plain text from a document using liteparse.

    Parameters
    ----------
    file_path:
        Path to the document. Supported: PDF, images, DOCX, XLSX, PPTX, ODT, …
    ocr_enabled:
        Override OCR behaviour. When ``None`` (default) the function auto-selects:
        - PDF  → tries without OCR first; falls back to OCR if text is sparse.
        - Image → always enables OCR.
        Pass ``True`` / ``False`` to force a specific mode.

    Returns
    -------
    str
        Extracted text, stripped. Empty string on any parse failure.
    """
    try:
        from liteparse import LiteParse  # type: ignore[import]
    except ImportError:
        logger.warning(
            "liteparse not installed - falling back to legacy extraction for %s",
            file_path.name,
        )
        raise  # callers catch ImportError to trigger their own fallback

    parser = LiteParse()
    suffix = file_path.suffix.lower()
    is_image = suffix in _IMAGE_SUFFIXES

    if ocr_enabled is not None:
        # Explicit override requested.
        try:
            result = parser.parse(str(file_path), ocr_enabled=ocr_enabled)
            return result.text.strip()
        except Exception as exc:
            logger.debug(
                "liteparse (ocr=%s) failed for %s: %s", ocr_enabled, file_path.name, exc
            )
            return ""

    if is_image:
        # Images always need OCR.
        try:
            result = parser.parse(str(file_path), ocr_enabled=True)
            return result.text.strip()
        except Exception as exc:
            logger.debug("liteparse (image OCR) failed for %s: %s", file_path.name, exc)
            return ""

    # PDF (or any other format): try text layer first, then OCR if sparse.
    try:
        result = parser.parse(str(file_path), ocr_enabled=False)
        text = result.text.strip()
        if len(text) >= 50:  # OCR_CHAR_THRESHOLD from ocr.py
            return text
        logger.debug(
            "liteparse text-only returned %d chars for %s - retrying with OCR",
            len(text),
            file_path.name,
        )
    except Exception as exc:
        logger.debug("liteparse (no OCR) failed for %s: %s", file_path.name, exc)
        text = ""

    # Retry with OCR enabled.
    try:
        result = parser.parse(str(file_path), ocr_enabled=True)
        return result.text.strip()
    except Exception as exc:
        logger.debug("liteparse (with OCR) failed for %s: %s", file_path.name, exc)
        return text  # Return whatever we got from the first pass (may be empty).

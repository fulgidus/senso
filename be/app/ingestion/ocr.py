"""
Document extraction pipelines for unknown-format PDF and image files.

These pipelines are only reached AFTER registry module matching fails in
_extract() (ingestion_service.py). Modules handle known constant-format
data (CSV, XLSX, known PDF layouts) and produce structured output directly.

When no module matches, we land here:

PDF pipeline (extract_with_pdf_pipeline):
  1. LiteParse text extraction (text layer + OCR fallback)
  2. LLM text structuring (send LiteParse text to LLM with structured schema)
  3. LLM vision OCR (vision:ocr:lg — send raw bytes to multimodal LLM)

Image pipeline (extract_with_image_pipeline):
  1. LiteParse OCR (local text extraction)
  2. LLM text structuring (send OCR text to LLM with structured schema)
  3. LLM vision OCR (vision:ocr:lg — last resort)

OCR_CHAR_THRESHOLD: minimum chars to consider extracted text "usable"
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.ingestion.llm import LLMClient, LLMError
from app.ingestion.liteparse_extractor import extract_single
from app.ingestion.prompts.loader import (
    get_schema,
    render_llm_text_ocr_system,
    render_llm_text_ocr_prompt,
    render_llm_vision_ocr_system,
    render_llm_vision_ocr_prompt,
)
from app.schemas.ingestion import ExtractedDocument, ExtractionResult

logger = logging.getLogger(__name__)

OCR_CHAR_THRESHOLD = 50  # below this → treat as empty/garbage


# ═══════════════════════════════════════════════════════════════════════════════
# Text extraction helpers
# ═══════════════════════════════════════════════════════════════════════════════


def extract_pdf_text_layer(file_path: Path) -> str:
    """
    Extract text from a PDF using liteparse (text layer first, OCR if sparse).
    Returns empty string on any error (including if liteparse is not installed).
    """
    try:
        return extract_single(file_path, ocr=False) or extract_single(file_path, ocr=True)
    except Exception:
        logger.warning(
            "liteparse unavailable - skipping text extraction for %s", file_path.name
        )
        return ""


def extract_text_with_tesseract(file_path: Path) -> str:
    """
    Extract text from an image using liteparse OCR mode.
    Name kept for backwards compatibility with callers; no longer uses Tesseract.
    Returns empty string on any error (including if liteparse is not installed).
    """
    try:
        return extract_single(file_path, ocr=True)
    except Exception:
        logger.warning("liteparse unavailable - skipping OCR for %s", file_path.name)
        return ""


def _is_usable(text: str) -> bool:
    return len(text.strip()) >= OCR_CHAR_THRESHOLD


# ═══════════════════════════════════════════════════════════════════════════════
# Module-match helper (shared by both pipelines)
# ═══════════════════════════════════════════════════════════════════════════════


# Module matching is handled upstream in ingestion_service._extract().
# These pipelines only handle the unknown-format fallback path.


# ═══════════════════════════════════════════════════════════════════════════════
# LLM text + vision fallbacks
# ═══════════════════════════════════════════════════════════════════════════════


def _llm_text_fallback(
    text: str, llm_client: LLMClient, tier: str
) -> ExtractionResult | None:
    """Direct LLM text extraction. Returns None on failure."""
    try:
        raw = llm_client.complete(
            prompt=render_llm_text_ocr_prompt(text),
            system=render_llm_text_ocr_system(),
            response_schema=get_schema("extracted_document"),
            route="text:generation:md",
            timeout=60.0,
        )
        doc = ExtractedDocument(**json.loads(raw))
        return ExtractionResult(
            document=doc,
            confidence=0.45,
            raw_text=text or None,
            tier_used=tier,
        )
    except (LLMError, json.JSONDecodeError, Exception) as exc:
        logger.warning("LLM text fallback failed: %s", exc)
        return None


def _llm_vision_fallback(
    file_path: Path, raw_text: str | None, llm_client: LLMClient, tier: str
) -> ExtractionResult:
    """
    Last-resort LLM vision extraction. Raises LLMError if all providers fail.
    """
    image_bytes = file_path.read_bytes()
    raw = llm_client.vision(
        prompt=render_llm_vision_ocr_prompt(),
        system=render_llm_vision_ocr_system(),
        image_bytes=image_bytes,
        response_schema=get_schema("extracted_document"),
        route="vision:ocr:lg",
    )
    doc = ExtractedDocument(**json.loads(raw))
    return ExtractionResult(
        document=doc,
        confidence=0.55,
        raw_text=raw_text,
        tier_used=tier,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PDF pipeline
# ═══════════════════════════════════════════════════════════════════════════════


def extract_with_pdf_pipeline(
    file_path: Path,
    llm_client: LLMClient,
    registry,
) -> ExtractionResult:
    """
    PDF pipeline for documents that did NOT match any registry module.
    Modules are already tried in _extract() before this is called.

    Steps:
      1. LiteParse text extraction (text layer + OCR)
      2. LLM text structuring (send LiteParse text to LLM for structured extraction)
      3. LLM vision (last resort - send raw bytes to multimodal LLM)
    """
    # Step 1: Extract text with LiteParse
    text = extract_pdf_text_layer(file_path)
    if _is_usable(text):
        logger.debug("PDF %s: LiteParse text usable (%d chars)", file_path.name, len(text))

        # Step 2: LLM text structuring — LiteParse gave us text, LLM structures it
        result = _llm_text_fallback(text, llm_client, "pdf_llm_text")
        if result is not None:
            return result
    else:
        logger.debug(
            "PDF %s: LiteParse yielded %d chars (below threshold), skipping to vision",
            file_path.name,
            len(text),
        )

    # Step 3: Last resort — LLM vision OCR
    logger.info("PDF %s: text path exhausted, trying LLM vision OCR", file_path.name)
    return _llm_vision_fallback(file_path, text or None, llm_client, "pdf_llm_vision")


# ═══════════════════════════════════════════════════════════════════════════════
# Image pipeline
# ═══════════════════════════════════════════════════════════════════════════════


def extract_with_image_pipeline(
    file_path: Path,
    llm_client: LLMClient,
    registry,
) -> ExtractionResult:
    """
    Image pipeline for documents that did NOT match any registry module.
    Modules are already tried in _extract() before this is called.

    Steps:
      1. LiteParse OCR (local text extraction)
      2. LLM text structuring (send LiteParse OCR text to LLM)
      3. LLM vision OCR (last resort - send raw bytes to multimodal LLM)
    """
    # Step 1: LiteParse OCR
    ocr_text = extract_text_with_tesseract(file_path)
    if _is_usable(ocr_text):
        logger.debug("Image %s: LiteParse OCR usable (%d chars)", file_path.name, len(ocr_text))

        # Step 2: LLM text structuring
        result = _llm_text_fallback(ocr_text, llm_client, "image_llm_text")
        if result is not None:
            return result

    # Step 3: LLM vision OCR (last resort)
    logger.info("Image %s: LiteParse OCR insufficient, trying LLM vision OCR", file_path.name)
    return _llm_vision_fallback(
        file_path, ocr_text or None, llm_client, "image_llm_vision"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Legacy entry point (kept for backwards compat - routes to the new pipelines)
# ═══════════════════════════════════════════════════════════════════════════════


def extract_with_ocr_pipeline(
    file_path: Path,
    llm_client: LLMClient,
    registry=None,
) -> ExtractionResult:
    """
    Backwards-compatible entry point. Routes to the correct new pipeline.
    If registry is None, a fresh registry singleton is used.
    """
    if registry is None:
        from app.ingestion.registry import get_registry

        registry = get_registry()

    if file_path.suffix.lower() == ".pdf":
        return extract_with_pdf_pipeline(file_path, llm_client, registry)
    return extract_with_image_pipeline(file_path, llm_client, registry)

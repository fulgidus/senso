"""
Document extraction pipelines for image and PDF files.

PDF pipeline (extract_with_pdf_pipeline):
  1. Extract text via liteparse (text layer, then OCR fallback within liteparse)
  2. If good text → try registry module match → run module
  3. If no module match → run adaptive pipeline (classify → gen module → tests → register)
  4. If adaptive fails → LLM text extraction
  5. Last resort → LLM vision (vision:ocr:lg)

Image pipeline (extract_with_image_pipeline):
  1. Extract text via liteparse (OCR mode)
  2. If good text → try registry module match → run module
  3. If no module match → adaptive pipeline on OCR text
  4. Fallback → LLM text extraction
  5. Last resort → LLM vision

OCR_CHAR_THRESHOLD: minimum chars to consider extracted text "usable"
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.ingestion.llm import LLMClient, LLMError
from app.ingestion.liteparse_extractor import extract_text_with_liteparse
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
    Returns empty string on any error.
    """
    return extract_text_with_liteparse(file_path)


def extract_text_with_tesseract(file_path: Path) -> str:
    """
    Extract text from an image using liteparse OCR mode.
    Name kept for backwards compatibility with callers; no longer uses Tesseract.
    Returns empty string on any error.
    """
    return extract_text_with_liteparse(file_path, ocr_enabled=True)


def _is_usable(text: str) -> bool:
    return len(text.strip()) >= OCR_CHAR_THRESHOLD


# ═══════════════════════════════════════════════════════════════════════════════
# Module-match helper (shared by both pipelines)
# ═══════════════════════════════════════════════════════════════════════════════


def _try_module_match(file_path: Path, text: str, registry) -> ExtractionResult | None:
    """
    Try to match file against registry. If matched, run extract() and return result.
    Returns None if no match or module fails.
    """
    entry = registry.match(file_path, text[:4096])
    if entry is None:
        return None
    try:
        raw = entry.extract_fn(file_path)
        if isinstance(raw, ExtractionResult):
            return raw
        doc = ExtractedDocument(**raw)
        return ExtractionResult(document=doc, confidence=0.85, tier_used="module")
    except Exception as exc:
        logger.warning("Module %r failed on %s: %s", entry.name, file_path.name, exc)
        return None


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
            tier_used=tier,  # type: ignore[arg-type]
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
        tier_used=tier,  # type: ignore[arg-type]
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
    Full PDF pipeline. Raises LLMError only if the absolute last resort (vision) fails.
    liteparse handles both embedded-text-layer extraction and scanned-page OCR
    internally, so there is no separate Tesseract step.
    """
    from app.ingestion.adaptive import run_adaptive_pipeline

    # Step 1: Extract text (liteparse tries text layer then OCR automatically)
    text = extract_pdf_text_layer(file_path)
    if _is_usable(text):
        logger.debug("PDF %s: text usable (%d chars)", file_path.name, len(text))

        # Step 2: Module match
        result = _try_module_match(file_path, text, registry)
        if result is not None:
            result.tier_used = "pdf_text_layer_module"  # type: ignore[assignment]
            result.raw_text = text
            return result

        # Step 3: Adaptive pipeline
        result = run_adaptive_pipeline(file_path, text, llm_client, registry)
        if result.confidence >= 0.3:
            return result

        # Step 4: LLM text extraction
        result = _llm_text_fallback(text, llm_client, "pdf_llm_text")
        if result is not None:
            return result

    else:
        logger.debug(
            "PDF %s: text extraction yielded %d chars, falling back to LLM vision",
            file_path.name,
            len(text),
        )

    # Step 5: Last resort — LLM vision
    logger.info("PDF %s: all text paths exhausted, trying LLM vision", file_path.name)
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
    Pipeline for non-PDF image files (JPEG, PNG, etc).
    Raises LLMError only if last-resort vision fails.
    """
    from app.ingestion.adaptive import run_adaptive_pipeline

    # Step 1: liteparse OCR
    ocr_text = extract_text_with_tesseract(file_path)
    if _is_usable(ocr_text):
        # Step 2: Module match
        result = _try_module_match(file_path, ocr_text, registry)
        if result is not None:
            result.tier_used = "image_ocr_module"  # type: ignore[assignment]
            result.raw_text = ocr_text
            return result

        # Step 3: Adaptive pipeline
        result = run_adaptive_pipeline(file_path, ocr_text, llm_client, registry)
        if result.confidence >= 0.3:
            return result

        # Step 4: LLM text
        result = _llm_text_fallback(ocr_text, llm_client, "image_llm_text")
        if result is not None:
            return result

    # Step 5: LLM vision (last resort)
    logger.info("Image %s: OCR text insufficient, trying LLM vision", file_path.name)
    return _llm_vision_fallback(
        file_path, ocr_text or None, llm_client, "image_llm_vision"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Legacy entry point (kept for backwards compat — routes to the new pipelines)
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

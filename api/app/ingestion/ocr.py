"""
Three-tier OCR pipeline for image/PDF files:
  Tier 1 — pytesseract OCR (fast, cheap)
  Tier 2 — LLM text extraction (if ≥50 chars from OCR)
  Tier 3 — LLM vision extraction (if <50 chars from OCR)
"""

import json
from pathlib import Path

from app.ingestion.llm import LLMClient, LLMError
from app.schemas.ingestion import ExtractedDocument, ExtractionResult

OCR_CHAR_THRESHOLD = 50

OCR_LLM_SYSTEM = (
    "You are a financial document extractor. Extract structured data from the provided text "
    "and return ONLY valid JSON matching this schema: {schema}. Use null for unknown fields."
)


def _get_extracted_doc_schema() -> str:
    return str(ExtractedDocument.model_json_schema())


def extract_text_with_tesseract(file_path: Path) -> str:
    """Attempt OCR with pytesseract. Returns empty string on failure."""
    try:
        import pytesseract
        from PIL import Image

        if file_path.suffix.lower() == ".pdf":
            from pdf2image import convert_from_path

            pages = convert_from_path(str(file_path), dpi=200)
            texts = [pytesseract.image_to_string(p) for p in pages]
            return "\n".join(texts)
        else:
            img = Image.open(file_path)
            return pytesseract.image_to_string(img)
    except Exception:
        return ""


def extract_with_ocr_pipeline(
    file_path: Path,
    llm_client: LLMClient,
) -> ExtractionResult:
    """
    Run the three-tier pipeline. Returns ExtractionResult with tier_used set.
    Raises LLMError if Tier 3 is needed but all providers fail.
    """
    schema_str = _get_extracted_doc_schema()

    # Tier 1: pytesseract
    raw_text = extract_text_with_tesseract(file_path)
    usable_chars = len(raw_text.strip())

    if usable_chars >= OCR_CHAR_THRESHOLD:
        # Tier 2: LLM text extraction
        try:
            prompt = f"Document text:\n\n{raw_text}\n\nExtract financial data as JSON."
            system = OCR_LLM_SYSTEM.format(schema=schema_str)
            raw_json = llm_client.complete(prompt=prompt, system=system, json_mode=True)
            doc_data = json.loads(raw_json)
            doc = ExtractedDocument(**doc_data)
            return ExtractionResult(
                document=doc,
                confidence=0.75,
                raw_text=raw_text,
                tier_used="llm_text",
            )
        except Exception:
            pass  # Fall through to Tier 3

    # Tier 3: LLM vision (also used if Tier 2 failed)
    image_bytes = file_path.read_bytes()
    prompt = "Extract all financial data from this document image. Return JSON only."
    system = OCR_LLM_SYSTEM.format(schema=schema_str)
    raw_json = llm_client.vision(
        prompt=prompt,
        system=system,
        image_bytes=image_bytes,
        json_mode=True,
    )
    doc_data = json.loads(raw_json)
    doc = ExtractedDocument(**doc_data)
    return ExtractionResult(
        document=doc,
        confidence=0.65,
        raw_text=raw_text or None,
        tier_used="llm_vision",
    )

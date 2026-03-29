"""
Prompt templates for the ingestion pipeline.

All LLM prompts are centralized here to make iteration and A/B testing easy.
Templates use Python str.format_map() so callers pass a dict of values.
"""

from __future__ import annotations

# ── Allowed imports in generated modules ──────────────────────────────────────
IMPORT_WHITELIST = (
    "csv, io, re, datetime, decimal, json, base64, openpyxl, typing, pathlib, "
    "collections, itertools, functools, string"
)

# ── Document type labels ───────────────────────────────────────────────────────
DOCUMENT_TYPES = [
    "bank_statement",
    "payslip",
    "receipt",
    "invoice",
    "f24_tax_form",
    "road_fine",
    "certificato_unico",
    "utility_bill",
    "unknown",
]

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Document classification
# ═══════════════════════════════════════════════════════════════════════════════

CLASSIFY_SYSTEM = """\
You are a financial document classifier. Given document text, identify the document type.
Respond ONLY with valid JSON: {"document_type": "<type>", "confidence": <0.0-1.0>, "reasoning": "<brief>"}

Valid types: bank_statement, payslip, receipt, invoice, f24_tax_form, road_fine,
             certificato_unico, utility_bill, unknown
"""

CLASSIFY_PROMPT = """\
Document text (first {max_chars} characters):

{text}

Classify this document type. Reply with JSON only."""


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Module generation
# ═══════════════════════════════════════════════════════════════════════════════

MODULE_GEN_SYSTEM = f"""\
You are a Python financial document parser expert.
Generate a reusable extraction module for the document format shown.

The module MUST:
- Export FINGERPRINT: list[str]  — at least 2 unique keywords that identify this format
- Export MODULE_VERSION: str = "1.0.0"
- Export DOCUMENT_TYPE: str  — one of: bank_statement, payslip, receipt, invoice,
  f24_tax_form, road_fine, certificato_unico, utility_bill, unknown
- Export extract(file_path: str | Path) -> dict  — returns ExtractedDocument-compatible JSON
- ONLY import from this whitelist: {IMPORT_WHITELIST}
- NO os, NO subprocess, NO requests, NO sys, NO network I/O of any kind
- Return a dict with at minimum: document_type, transactions (list, may be empty)
- Handle malformed input gracefully (never raise, return partial results)

Respond ONLY with valid JSON:
{{
  "module_code": "...complete Python source...",
  "fingerprint_explanation": "...why these keywords identify this format..."
}}
"""

MODULE_GEN_PROMPT = """\
Document type: {document_type}
Document text (first {max_chars} characters):

{text}

Generate the extraction module. Reply with JSON only."""

MODULE_GEN_RETRY_PROMPT = """\
Previous attempt failed with this error:
{error}

Hint: {hint}

Document type: {document_type}
Document text (first {max_chars} characters):

{text}

Fix the error and generate the corrected extraction module. Reply with JSON only."""


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Unit test generation
# ═══════════════════════════════════════════════════════════════════════════════

UNIT_TEST_SYSTEM = """\
You are a Python test engineer. Given a financial document extraction module and a sample
document text, write pytest-style unit tests that validate the extract() function.

Tests MUST:
- Import the module by its file path using importlib (do not assume it is on sys.path)
- Call extract(file_path) with a real file path argument
- Assert document_type is correct
- Assert transactions list is a list (may be empty)
- Assert any expected key fields are present (use known values from the sample text)
- NOT rely on external network; NOT import os/subprocess/sys
- Be self-contained in a single file

Respond ONLY with valid JSON:
{"test_code": "...complete Python test source..."}
"""

UNIT_TEST_PROMPT = """\
Module code:
```python
{module_code}
```

Sample document text (first {max_chars} characters):
{text}

File path that will be used in tests: {file_path}

Write pytest unit tests. Reply with JSON only."""


# ═══════════════════════════════════════════════════════════════════════════════
# 4. LLM context-aware OCR (text variant — last resort for text-layer PDFs)
# ═══════════════════════════════════════════════════════════════════════════════

LLM_TEXT_OCR_SYSTEM = """\
You are a financial document extractor. Extract structured data from the provided document text.
Return ONLY valid JSON matching this schema: {schema}
Use null for unknown fields. Do not add commentary outside the JSON."""

LLM_TEXT_OCR_PROMPT = """\
Document text:

{text}

Extract all financial data as JSON."""

LLM_TEXT_OCR_RETRY_PROMPT = """\
Previous extraction attempt failed: {error}
Hint from user: {hint}

Document text:

{text}

Try again. Extract all financial data as JSON."""


# ═══════════════════════════════════════════════════════════════════════════════
# 5. LLM vision OCR (last resort for scanned images / image-only PDFs)
# ═══════════════════════════════════════════════════════════════════════════════

LLM_VISION_OCR_SYSTEM = """\
You are a financial document extractor. Extract structured data from this document image.
Return ONLY valid JSON matching this schema: {schema}
Use null for unknown fields."""

LLM_VISION_OCR_PROMPT = (
    "Extract all financial data from this document image. Return JSON only."
)

LLM_VISION_OCR_RETRY_PROMPT = """\
Previous attempt failed: {error}
User hint: {hint}

Extract all financial data from this document image. Return JSON only."""

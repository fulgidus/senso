"""
GenericInvoiceIT — Generic Italian invoice/receipt extractor.
Supported formats: PDF
Export path: N/A — generic fallback for Italian PDFs with invoice characteristics.
Sample FINGERPRINT keywords: "fattura", "partita iva", "importo totale", "codice fiscale"

Extracts key invoice fields from PDF text via pytesseract OCR.
Maps provider (from header text), total_due, billing period if present.
document_type is "utility_bill" as best-effort mapping for generic Italian invoices.
Used as a catch-all for any Italian-language PDF that looks like an invoice but
does not match a more specific module.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

FINGERPRINT: list[str] = [
    "fattura",
    "partita iva",
    "importo totale",
    "codice fiscale",
]
MODULE_VERSION: str = "1.0.0"


def _extract_pdf_text(path: Path) -> str:
    """Attempt pytesseract OCR on each PDF page. Returns empty string on failure."""
    try:
        import pytesseract  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415
        from pdf2image import convert_from_path  # noqa: PLC0415

        pages = convert_from_path(str(path), dpi=150)
        return "\n".join(pytesseract.image_to_string(p, lang="ita+eng") for p in pages)
    except Exception:
        return ""


def _parse_italian_decimal(s: str) -> Decimal:
    """Parse Italian decimal format: "1.234,56" → Decimal("1234.56")."""
    cleaned = s.strip().replace("€", "").replace(" ", "")
    if "." in cleaned and "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return Decimal(cleaned)


def extract(file_path: str | Path):  # noqa: ANN201
    """Extract invoice data from generic Italian PDF."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument  # noqa: PLC0415

    path = Path(file_path)
    raw_text = _extract_pdf_text(path)

    # ---- extract total_due ----
    total_due: Decimal | None = None
    for pattern in [
        r"importo\s+totale[:\s]+€?\s*([\d.,]+)",
        r"totale\s+(?:da\s+pagare|fattura|documento)[:\s]+€?\s*([\d.,]+)",
        r"totale\s+€\s*([\d.,]+)",
        r"importo\s+netto[:\s]+€?\s*([\d.,]+)",
        r"totale[:\s]+€?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            try:
                total_due = _parse_italian_decimal(m.group(1))
                break
            except InvalidOperation:
                continue

    # ---- extract provider from document header (first non-empty lines) ----
    provider: str | None = None
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    if lines:
        # Heuristic: first substantial line before "fattura" keyword is likely the provider
        for i, line in enumerate(lines[:10]):
            if "fattura" in line.lower():
                if i > 0:
                    provider = lines[i - 1]
                break
        if provider is None and lines:
            # Fall back to first line that isn't just a date or number
            for line in lines[:5]:
                if len(line) > 3 and not re.match(r"^\d", line):
                    provider = line
                    break

    # ---- extract billing period ----
    billing_start = None
    billing_end = None
    period_match = re.search(
        r"(?:periodo|dal)[:\s]+(\d{2}/\d{2}/\d{4}).*?(?:al)[:\s]+(\d{2}/\d{2}/\d{4})",
        raw_text,
        re.IGNORECASE | re.DOTALL,
    )
    if period_match:
        from datetime import datetime  # noqa: PLC0415

        try:
            billing_start = datetime.strptime(period_match.group(1), "%d/%m/%Y").date()
            billing_end = datetime.strptime(period_match.group(2), "%d/%m/%Y").date()
        except ValueError:
            pass

    # ---- extract account/invoice number ----
    account_number: str | None = None
    inv_match = re.search(
        r"(?:fattura\s+n[°.]?|n[°.]\s+fattura)[:\s]+([A-Z0-9/-]+)",
        raw_text,
        re.IGNORECASE,
    )
    if inv_match:
        account_number = inv_match.group(1).strip()

    confidence = 0.7 if total_due is not None else (0.5 if raw_text else 0.2)

    return ExtractionResult(
        document=ExtractedDocument(
            document_type="utility_bill",
            module_name="GenericInvoiceIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
            provider=provider,
            total_due=total_due,
            billing_period_start=billing_start,
            billing_period_end=billing_end,
            account_number=account_number,
            currency="EUR",
        ),
        confidence=confidence,
        raw_text=raw_text or None,
        tier_used="module",
        warnings=[]
        if raw_text
        else [
            "GenericInvoiceIT: OCR unavailable — install pytesseract for better extraction"
        ],
    )

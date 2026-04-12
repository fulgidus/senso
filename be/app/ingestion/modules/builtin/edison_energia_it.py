"""
EdisonEnergiaIT - Edison Energia Italy utility bill extractor.
Supported formats: PDF
Export path: Edison web portal (clienti.edison.it) → Fatture → Scarica PDF
Sample FINGERPRINT keywords: "edison", "energia", "fornitura di energia", "kwh", "codice cliente"

Extracts key bill fields from PDF text via liteparse.
Maps service_type (electricity / gas / electricity+gas), provider, total_due, billing period.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

FINGERPRINT: list[str] = [
    "edison",
    "energia",
    "fornitura di energia",
    "kwh",
    "codice cliente",
]
MODULE_VERSION: str = "1.0.0"


def _extract_pdf_text(path: Path) -> str:
    """Extract text from PDF via liteparse (text layer + OCR fallback)."""
    from app.ingestion.liteparse_extractor import extract_text_with_liteparse  # noqa: PLC0415

    return extract_text_with_liteparse(path)


def _parse_italian_decimal(s: str) -> Decimal:
    """Parse Italian decimal format: "1.234,56" → Decimal("1234.56")."""
    cleaned = s.strip().replace("€", "").replace(" ", "")
    if "." in cleaned and "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return Decimal(cleaned)


def extract(file_path: str | Path):  # noqa: ANN201
    """Extract utility bill info from Edison Energia PDF."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument  # noqa: PLC0415

    path = Path(file_path)
    raw_text = _extract_pdf_text(path)
    raw_lower = raw_text.lower()

    # ---- extract total_due ----
    total_due: Decimal | None = None
    for pattern in [
        r"totale\s+(?:da\s+pagare|importo|fattura)[:\s]+€?\s*([\d.,]+)",
        r"importo\s+totale[:\s]+€?\s*([\d.,]+)",
        r"totale\s+€\s*([\d.,]+)",
        r"€\s*([\d.,]+)\s+da\s+pagare",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            try:
                total_due = _parse_italian_decimal(m.group(1))
                break
            except InvalidOperation:
                continue

    # ---- detect service type ----
    has_gas = bool(re.search(r"\b(gas|metano)\b", raw_lower))
    has_electricity = bool(re.search(r"\b(luce|elettric|kwh)\b", raw_lower))
    if has_electricity and has_gas:
        service_type = "electricity+gas"
    elif has_gas:
        service_type = "gas"
    else:
        service_type = "electricity"

    # ---- extract billing period ----
    billing_start = None
    billing_end = None
    period_match = re.search(
        r"periodo\s+(?:di\s+)?fornitura[:\s]+(?:dal\s+)?(\d{2}/\d{2}/\d{4}).*?(?:al\s+)?(\d{2}/\d{2}/\d{4})",
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

    # ---- extract account_number ----
    account_number: str | None = None
    acct_match = re.search(
        r"codice\s+(?:cliente|pod|pdr)[:\s]+([A-Z0-9]+)", raw_text, re.IGNORECASE
    )
    if acct_match:
        account_number = acct_match.group(1).strip()

    confidence = 0.7 if total_due is not None else (0.5 if raw_text else 0.3)

    return ExtractionResult(
        document=ExtractedDocument(
            document_type="utility_bill",
            module_name="EdisonEnergiaIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
            provider="Edison Energia",
            service_type=service_type,
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
        else ["EdisonEnergiaIT: could not extract text from PDF"],
    )

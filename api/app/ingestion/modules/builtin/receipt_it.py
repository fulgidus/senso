"""
ReceiptIT - Italian receipt (scontrino fiscale / ricevuta) extractor.

Handles text-layer PDFs and OCR-processed receipt images.
Supports fiscal receipts (scontrino fiscale) and generic receipts (ricevuta).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from datetime import date
from pathlib import Path

FINGERPRINT: list[str] = [
    "scontrino",
    "ricevuta fiscale",
    "totale",
    "importo",
    "p.iva",
]
MIME_TYPES: list[str] = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
MODULE_VERSION: str = "1.0.0"


def _parse_decimal(text: str) -> Decimal | None:
    if not text:
        return None
    cleaned = text.replace(".", "").replace(",", ".").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_italian_date(text: str) -> date | None:
    # dd/mm/yyyy
    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](20\d{2})", text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def extract(file_path: Path, raw_text: str | None = None) -> dict:
    if raw_text is None:
        try:
            raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            raw_text = ""

    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

    # ── Total amount ─────────────────────────────────────────────────────────
    total_amount: Decimal | None = None
    for pattern in [
        r"totale\s+(?:eur|€)?\s*[:€]?\s*([\d.,]+)",
        r"importo\s+(?:eur|€)?\s*[:€]?\s*([\d.,]+)",
        r"da\s+pagare\s*[:€]?\s*([\d.,]+)",
        r"totale\s+complessivo\s*[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            total_amount = _parse_decimal(m.group(1))
            if total_amount and total_amount > 0:
                break

    # ── Merchant name ─────────────────────────────────────────────────────────
    # Heuristic: first non-empty line that is not a date/P.IVA/number
    merchant: str | None = None
    for line in lines[:8]:
        if re.match(r"^[\d/\-\s]+$", line):
            continue
        if re.match(r"^(p\.?\s*iva|cf|cod\.?\s*fisc)", line, re.IGNORECASE):
            continue
        if re.match(r"^(scontrino|ricevuta|fiscale)", line, re.IGNORECASE):
            continue
        if len(line) > 3:
            merchant = line[:80]
            break

    # ── Purchase date ─────────────────────────────────────────────────────────
    purchase_date: date | None = None
    for line in lines:
        d = _parse_italian_date(line)
        if d:
            purchase_date = d
            break

    # ── Line items (best-effort) ──────────────────────────────────────────────
    # Pattern: "DESCRIPTION   EUR 12,34" or "ITEM   12,34"
    line_items: list[dict] = []
    item_pattern = re.compile(
        r"^(.+?)\s+([\d.,]+)\s*$"
    )
    skip_keywords = {"totale", "importo", "iva", "resto", "contante", "carta", "scontrino"}
    for line in lines:
        m = item_pattern.match(line)
        if m:
            desc = m.group(1).strip()
            if any(kw in desc.lower() for kw in skip_keywords):
                continue
            amt = _parse_decimal(m.group(2))
            if amt and amt > 0 and len(desc) > 2:
                line_items.append({
                    "description": desc,
                    "amount": float(amt),
                    "currency": "EUR",
                })
                if len(line_items) >= 20:  # cap
                    break

    return {
        "document_type": "receipt",
        "merchant": merchant,
        "total_amount": total_amount,
        "purchase_date": purchase_date,
        "line_items": line_items,
        "transactions": [],
        "module_name": "receipt_it",
        "module_source": "builtin",
        "module_version": MODULE_VERSION,
    }

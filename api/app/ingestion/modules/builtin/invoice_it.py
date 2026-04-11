"""
InvoiceIT - Generic Italian invoice (fattura) extractor.

Handles standard Italian invoice layouts: B2B and B2C fatture elettroniche
and paper invoices. Extracts vendor, total, VAT, due date, invoice number.

Maps to schema fields:
  merchant → vendor name
  total_amount → total invoice amount (IVA included)
  line_items → [{"description": "IVA ...", "amount": vat_amount}, ...]
  purchase_date → invoice/due date
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from datetime import date
from pathlib import Path

FINGERPRINT: list[str] = [
    "fattura",
    "imponibile",
    "iva",
    "totale",
    "partita iva",
    "numero fattura",
]
MIME_TYPES: list[str] = ["application/pdf"]
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
    """Parse Italian date formats: 15/03/2025, 15-03-2025, 15 marzo 2025"""
    months = {
        "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
        "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
        "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
    }
    # dd/mm/yyyy or dd-mm-yyyy
    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](20\d{2})", text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    # dd month yyyy
    m2 = re.search(
        r"(\d{1,2})\s+(" + "|".join(months.keys()) + r")\s+(20\d{2})",
        text, re.IGNORECASE
    )
    if m2:
        try:
            return date(int(m2.group(3)), months[m2.group(2).lower()], int(m2.group(1)))
        except (ValueError, KeyError):
            pass
    return None


def extract(file_path: Path, raw_text: str | None = None) -> dict:
    if raw_text is None:
        try:
            from app.ingestion.liteparse_extractor import extract_text_with_liteparse
            raw_text = extract_text_with_liteparse(file_path) or ""
        except Exception:
            try:
                raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                raw_text = ""

    # ── Vendor / supplier ────────────────────────────────────────────────────
    merchant: str | None = None
    for pattern in [
        r"cedente\s*/\s*prestatore\s*[:\-]?\s*([^\n]+)",
        r"fornitore\s*[:\-]?\s*([^\n]+)",
        r"emittente\s*[:\-]?\s*([^\n]+)",
        r"ragione\s+sociale\s*[:\-]?\s*([^\n]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            merchant = m.group(1).strip()[:120]
            if merchant:
                break

    # ── Total amount (IVA incl.) ──────────────────────────────────────────────
    total_amount: Decimal | None = None
    for pattern in [
        r"totale\s+(?:fattura|da\s+pagare|documento)\s*(?:eur|€)?\s*[:\s]?\s*([\d.,]+)",
        r"importo\s+totale\s*(?:eur|€)?\s*[:€]?\s*([\d.,]+)",
        r"totale\s+(?:ivato|complessivo)\s*(?:eur|€)?\s*[:€]?\s*([\d.,]+)",
        r"\btotale\b\s*(?:eur|€)?\s*[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            total_amount = _parse_decimal(m.group(1))
            if total_amount and total_amount > 0:
                break

    # ── VAT amount ───────────────────────────────────────────────────────────
    vat_amount: Decimal | None = None
    for pattern in [
        r"totale\s+iva\s*[:€]?\s*([\d.,]+)",
        r"iva\s+\d+%\s*[:€]?\s*([\d.,]+)",
        r"imposta\s*[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            vat_amount = _parse_decimal(m.group(1))
            if vat_amount is not None:
                break

    # ── Invoice number ────────────────────────────────────────────────────────
    invoice_number: str | None = None
    m_inv = re.search(
        r"(?:numero\s+fattura|n\.\s*fattura|fattura\s+n[°.]?)\s*[:\-]?\s*([A-Z0-9/\-]+)",
        raw_text, re.IGNORECASE
    )
    if m_inv:
        invoice_number = m_inv.group(1).strip()

    # ── Due date ──────────────────────────────────────────────────────────────
    due_date: date | None = None
    m_date = re.search(
        r"(?:data\s+scadenza|scadenza\s+pagamento|scadenza)\s*[:\-]?\s*([\d/\-\w\s]+)",
        raw_text, re.IGNORECASE
    )
    if m_date:
        due_date = _parse_italian_date(m_date.group(1))

    # Build line_items for VAT and invoice number tracking
    line_items: list[dict] = []
    if vat_amount is not None:
        line_items.append({"description": "IVA", "amount": float(vat_amount), "currency": "EUR"})
    if invoice_number:
        line_items.append({"description": f"Fattura N. {invoice_number}", "amount": 0.0, "currency": "EUR"})

    return {
        "document_type": "invoice",
        "merchant": merchant,
        "total_amount": total_amount,
        "purchase_date": due_date,
        "line_items": line_items,
        "transactions": [],
        "module_name": "invoice_it",
        "module_source": "builtin",
        "module_version": MODULE_VERSION,
    }

"""
PayslipIT - Italian payslip (busta paga / cedolino) extractor.

Handles common Italian payslip layouts: INPS/IRPEF deductions, net/gross salary,
employer name, pay period. Works on PDF text layer; OCR text also accepted.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

FINGERPRINT: list[str] = [
    "busta paga",
    "cedolino",
    "netto",
    "lordo",
    "datore di lavoro",
]
MIME_TYPES: list[str] = ["application/pdf"]
MODULE_VERSION: str = "1.0.0"


def _parse_decimal(text: str) -> Decimal | None:
    """Parse Italian-formatted number: 1.234,56 → 1234.56"""
    if not text:
        return None
    # Remove thousands separator (period), replace decimal comma with dot
    cleaned = text.replace(".", "").replace(",", ".").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def extract(file_path: Path, raw_text: str | None = None) -> dict:
    """Extract payslip fields from raw_text (PDF text layer or OCR output)."""
    if raw_text is None:
        try:
            from app.ingestion.liteparse_extractor import extract_text_with_liteparse
            raw_text = extract_text_with_liteparse(file_path) or ""
        except Exception:
            try:
                raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                raw_text = ""

    text = raw_text

    # ── Net income ───────────────────────────────────────────────────────────
    # Patterns: "Netto a Pagare  1.234,56" / "NETTO 1234,56" / "Importo Netto 1.234,56"
    net_income: Decimal | None = None
    for pattern in [
        r"netto\s+a\s+pagare\s*[:€]?\s*([\d.,]+)",
        r"importo\s+netto\s*[:€]?\s*([\d.,]+)",
        r"\bnetto\b\s*[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            net_income = _parse_decimal(m.group(1))
            if net_income and net_income > 0:
                break

    # ── Gross income ─────────────────────────────────────────────────────────
    gross_income: Decimal | None = None
    for pattern in [
        r"retribuzione\s+lorda\s*[:€]?\s*([\d.,]+)",
        r"imponibile\s+fiscale\s*[:€]?\s*([\d.,]+)",
        r"\blordo\b\s*[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            gross_income = _parse_decimal(m.group(1))
            if gross_income and gross_income > 0:
                break

    # ── Employer ──────────────────────────────────────────────────────────────
    employer: str | None = None
    for pattern in [
        r"datore\s+di\s+lavoro\s*[:\-]?\s*([A-Za-zÀ-ú\s\.]+?)(?:\n|CF|P\.IVA|$)",
        r"azienda\s*[:\-]?\s*([A-Za-zÀ-ú\s\.]+?)(?:\n|CF|P\.IVA|$)",
        r"ragione\s+sociale\s*[:\-]?\s*([A-Za-zÀ-ú\s\.]+?)(?:\n|CF|P\.IVA|$)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            employer = m.group(1).strip()
            if employer:
                break

    # ── Pay period ────────────────────────────────────────────────────────────
    pay_period: str | None = None
    # "Mese di Gennaio 2025" / "01/2025" / "Marzo 2024"
    months_it = {
        "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
        "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
        "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12",
    }
    m = re.search(
        r"mese\s+di\s+(" + "|".join(months_it.keys()) + r")\s+(\d{4})",
        text, re.IGNORECASE
    )
    if m:
        month_num = months_it.get(m.group(1).lower(), "01")
        pay_period = f"{m.group(2)}-{month_num}"
    else:
        # Try numeric month: 01/2025
        m2 = re.search(r"\b(0[1-9]|1[0-2])[/\-](20\d{2})\b", text)
        if m2:
            pay_period = f"{m2.group(2)}-{m2.group(1)}"

    # ── INPS contribution ─────────────────────────────────────────────────────
    inps: Decimal | None = None
    m_inps = re.search(
        r"contributi?\s+inps\s*[:€]?\s*([\d.,]+)", text, re.IGNORECASE
    )
    if m_inps:
        inps = _parse_decimal(m_inps.group(1))

    # ── IRPEF withheld ────────────────────────────────────────────────────────
    irpef: Decimal | None = None
    m_irpef = re.search(
        r"irpef\s*[:€]?\s*([\d.,]+)", text, re.IGNORECASE
    )
    if m_irpef:
        irpef = _parse_decimal(m_irpef.group(1))

    return {
        "document_type": "payslip",
        "employer": employer,
        "gross_income": gross_income,
        "net_income": net_income,
        "deductions": _build_deductions(inps, irpef),
        "transactions": [],
        "module_name": "payslip_it",
        "module_source": "builtin",
        "module_version": MODULE_VERSION,
    }


def _build_deductions(inps: Decimal | None, irpef: Decimal | None) -> list[dict]:
    items = []
    if inps is not None:
        items.append({"description": "INPS", "amount": float(inps), "currency": "EUR"})
    if irpef is not None:
        items.append({"description": "IRPEF", "amount": float(irpef), "currency": "EUR"})
    return items

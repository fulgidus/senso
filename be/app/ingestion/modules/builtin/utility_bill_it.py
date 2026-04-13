"""
UtilityBillIT - Italian utility bill extractor.

Handles: electricity (ENEL, A2A, Eni Plenitude), gas (ENI, Italgas),
water (ACEA, Hera), telecoms (TIM, Vodafone, WindTre, Fastweb).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

FINGERPRINT: list[str] = [
    "bolletta",
    "importo dovuto",
    "data scadenza",
    "codice cliente",
    "kwh",
]
MIME_TYPES: list[str] = ["application/pdf"]
MODULE_VERSION: str = "1.0.0"

_KNOWN_PROVIDERS: list[tuple[str, str]] = [
    # (pattern, canonical_name)
    (r"\benel\b", "ENEL"),
    (r"\ba2a\b", "A2A"),
    (r"\beni\s+plenitude\b", "ENI Plenitude"),
    (r"\beni\b", "ENI"),
    (r"\bitalgas\b", "Italgas"),
    (r"\bacea\b", "ACEA"),
    (r"\bhera\b", "Hera"),
    (r"\btim\b", "TIM"),
    (r"\bvodafone\b", "Vodafone"),
    (r"\bwindtre\b|\bwind tre\b", "WindTre"),
    (r"\bfastweb\b", "Fastweb"),
]

_SERVICE_KEYWORDS: dict[str, list[str]] = {
    "luce": ["kwh", "energia elettrica", "fornitura luce", "elettricità"],
    "gas": ["mc ", "smc", "fornitura gas", "gas naturale", "metano"],
    "acqua": ["m3", "fornitura idrica", "acquedotto", "acqua potabile"],
    "telefono": ["giga", "minuti", "traffico dati", "sim", "rete mobile", "fibra"],
}


def _parse_decimal(text: str) -> Decimal | None:
    if not text:
        return None
    cleaned = text.replace(".", "").replace(",", ".").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def extract(file_path: Path, raw_text: str | None = None) -> dict:
    if raw_text is None:
        try:
            from app.ingestion.liteparse_extractor import extract_single
            raw_text = extract_single(file_path) or ""
        except Exception:
            try:
                raw_text = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                raw_text = ""

    text_lower = raw_text.lower()

    # ── Provider ─────────────────────────────────────────────────────────────
    provider: str | None = None
    for pattern, canonical in _KNOWN_PROVIDERS:
        if re.search(pattern, text_lower):
            provider = canonical
            break

    # ── Service type ─────────────────────────────────────────────────────────
    service_type: str | None = None
    for stype, keywords in _SERVICE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            service_type = stype
            break
    if service_type is None:
        service_type = "utility"

    # ── Total due ─────────────────────────────────────────────────────────────
    total_due: Decimal | None = None
    for pattern in [
        r"importo\s+dovuto\s*[:€]?\s*([\d.,]+)",
        r"totale\s+fattura\s*[:€]?\s*([\d.,]+)",
        r"importo\s+da\s+pagare\s*[:€]?\s*([\d.,]+)",
        r"totale\s+[:€]?\s*([\d.,]+)",
    ]:
        m = re.search(pattern, raw_text, re.IGNORECASE)
        if m:
            total_due = _parse_decimal(m.group(1))
            if total_due and total_due > 0:
                break

    # ── Account number ─────────────────────────────────────────────────────────
    account_number: str | None = None
    m_acc = re.search(
        r"codice\s+cliente\s*[:\-]?\s*([A-Z0-9\-]+)", raw_text, re.IGNORECASE
    )
    if m_acc:
        account_number = m_acc.group(1).strip()

    return {
        "document_type": "utility_bill",
        "provider": provider,
        "service_type": service_type,
        "total_due": total_due,
        "account_number": account_number,
        "transactions": [],
        "module_name": "utility_bill_it",
        "module_source": "builtin",
        "module_version": MODULE_VERSION,
    }

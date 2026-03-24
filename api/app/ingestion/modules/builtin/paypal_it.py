"""
PaypalIT — PayPal Italy transaction history extractor.
Supported formats: CSV (primary), PDF (best-effort via OCR)
Export path: PayPal → Attività → Scarica attività → CSV
Sample FINGERPRINT keywords (from actual Italian CSV): "fuso orario", "codice transazione", "lordo", "netto", "descrizione"

Italian CSV column order (from real sample):
  Data | Ora | Fuso orario | Descrizione | Valuta | Lordo | Tariffa | Netto | Saldo | Codice transazione | ...

Amount columns use Italian number format: comma as decimal separator (e.g. "-48,62").
PayPal exports include paired rows for every transaction (outgoing + bank transfer refund).
We use the "Netto" column for the net amount; positive = incoming, negative = outgoing.
Only rows where Netto is non-zero are included.
"""

from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from datetime import datetime
from pathlib import Path

FINGERPRINT: list[str] = [
    "fuso orario",
    "codice transazione",
    "lordo",
    "netto",
    "pagamento express checkout",
    "pagamento preautorizzato",
]
MODULE_VERSION: str = "1.0.0"

# Column name candidates (lowercased)
_DATE_COLS = ["data"]
_DESC_COLS = ["descrizione"]
_CURRENCY_COLS = ["valuta"]
_GROSS_COLS = ["lordo"]
_NET_COLS = ["netto"]
_BALANCE_COLS = ["saldo"]
_TX_ID_COLS = ["codice transazione"]


def _parse_italian_decimal(s: str) -> Decimal:
    """Parse Italian decimal format (comma as decimal sep, period as thousands sep)."""
    cleaned = s.strip().replace('"', "").replace("€", "").replace(" ", "")
    # Italian: "1.234,56" → 1234.56
    # But simple values like "-48,62" → -48.62
    if "." in cleaned and "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return Decimal(cleaned)


def _parse_csv(path: Path):
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument, Transaction  # noqa: PLC0415

    with open(str(path), newline="", encoding="utf-8-sig", errors="ignore") as f:
        content = f.read()

    # PayPal CSV may use semicolons in some locales — detect delimiter
    first_line = content.split("\n")[0] if content else ""
    delimiter = ";" if ";" in first_line and "," not in first_line else ","

    reader = csv.reader(content.splitlines(), delimiter=delimiter, quotechar='"')
    raw_rows = list(reader)

    if not raw_rows:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="PaypalIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=["Empty CSV file"],
        )

    header = [h.lower().strip().strip('"').strip() for h in raw_rows[0]]

    def _idx(candidates: list[str]) -> int | None:
        for cand in candidates:
            for i, h in enumerate(header):
                if cand in h:
                    return i
        return None

    date_col = _idx(_DATE_COLS)
    desc_col = _idx(_DESC_COLS)
    currency_col = _idx(_CURRENCY_COLS)
    net_col = _idx(_NET_COLS)
    balance_col = _idx(_BALANCE_COLS)

    if date_col is None or net_col is None:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="PaypalIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.3,
            tier_used="module",
            warnings=["PaypalIT: required columns not found"],
        )

    transactions = []
    statement_start = None
    statement_end = None

    for row in raw_rows[1:]:
        if not row or len(row) <= max(c for c in [date_col, net_col] if c is not None):
            continue
        try:
            date_str = row[date_col].strip().strip('"') if date_col < len(row) else ""
            if not date_str:
                continue

            # PayPal Italian date format: "1/1/2026" (day/month/year without zero-padding)
            parsed_date = None
            for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d"):
                try:
                    parsed_date = datetime.strptime(date_str.strip(), fmt).date()
                    break
                except ValueError:
                    continue
            if parsed_date is None:
                continue

            net_str = row[net_col].strip().strip('"') if net_col < len(row) else ""
            if not net_str:
                continue

            try:
                amount = _parse_italian_decimal(net_str)
            except InvalidOperation:
                continue

            # Skip zero-amount rows (PayPal has many internal transfer rows with 0 net)
            if amount == 0:
                continue

            desc_raw = (
                row[desc_col].strip().strip('"')
                if desc_col is not None and desc_col < len(row)
                else ""
            )
            currency = (
                row[currency_col].strip().strip('"')
                if currency_col is not None and currency_col < len(row)
                else "EUR"
            )

            balance_after: Decimal | None = None
            if (
                balance_col is not None
                and balance_col < len(row)
                and row[balance_col].strip()
            ):
                try:
                    balance_after = _parse_italian_decimal(
                        row[balance_col].strip().strip('"')
                    )
                except InvalidOperation:
                    pass

            if statement_start is None or parsed_date < statement_start:
                statement_start = parsed_date
            if statement_end is None or parsed_date > statement_end:
                statement_end = parsed_date

            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=desc_raw,
                    amount=amount,
                    currency=currency,
                    balance_after=balance_after,
                )
            )
        except (InvalidOperation, IndexError, ValueError):
            continue

    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="PaypalIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
            transactions=transactions,
            statement_period_start=statement_start,
            statement_period_end=statement_end,
        ),
        confidence=0.9 if transactions else 0.4,
        tier_used="module",
        warnings=[] if transactions else ["No transactions extracted"],
    )


def extract(file_path: str | Path):  # noqa: ANN201
    """Extract transactions from PayPal CSV/PDF export."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument  # noqa: PLC0415

    path = Path(file_path)
    if path.suffix.lower() in (".csv", ".txt"):
        return _parse_csv(path)

    # PDF: best-effort skeleton — OCR pipeline handles this better
    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="PaypalIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
        ),
        confidence=0.3,
        tier_used="module",
        warnings=[
            "PaypalIT: PDF extraction requires OCR pipeline — use CSV export for full accuracy"
        ],
    )

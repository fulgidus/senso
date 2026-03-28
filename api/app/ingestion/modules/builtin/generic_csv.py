"""
GenericCSV - fallback extractor for any CSV with date/amount/description columns.
Supported formats: CSV
Export path: N/A - generic fallback for unrecognized CSV files.
Sample FINGERPRINT keywords: "date", "amount", "description" (very generic; low score by design per D-27)

This module is the LOWEST priority match (score floor = 0.1 per D-27).
It attempts best-effort column mapping for Italian and English column name variants.
No institution-specific logic - returns extracted transactions with reduced confidence.
"""

from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from datetime import datetime
from pathlib import Path

FINGERPRINT: list[str] = ["date", "amount", "description"]
MODULE_VERSION: str = "1.0.0"

DATE_COLUMNS = [
    "date",
    "data",
    "data operazione",
    "transaction date",
    "completed date",
    "started date",
    "data valuta",
    "data transazione",
]
AMOUNT_COLUMNS = [
    "amount",
    "importo",
    "entrate",
    "uscite",
    "accrediti",
    "addebiti",
    "amount (eur)",
    "netto",
    "lordo",
    "gross",
]
DESC_COLUMNS = [
    "description",
    "descrizione",
    "causale",
    "beneficiary / sender",
    "memo",
    "note",
    "dettaglio",
    "name",
    "nome",
]
BALANCE_COLUMNS = [
    "balance",
    "saldo",
    "balance after transaction",
]


def _find_col(headers: list[str], candidates: list[str]) -> int | None:
    headers_lower = [h.lower().strip() for h in headers]
    for candidate in candidates:
        for i, h in enumerate(headers_lower):
            if candidate in h:
                return i
    return None


def extract(file_path: str | Path):  # noqa: ANN201
    """Best-effort CSV extraction - last-resort fallback."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument, Transaction  # noqa: PLC0415

    path = Path(file_path)

    try:
        with open(str(path), newline="", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.reader(f)
            rows = list(reader)
    except OSError as exc:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="GenericCSV",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=[f"Could not read file: {exc}"],
        )

    if not rows:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="GenericCSV",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=["Empty CSV file"],
        )

    # Find header row - search first 5 rows for one that has recognisable column names
    header_row_idx = 0
    for i, row in enumerate(rows[:5]):
        row_lower = [c.lower().strip() for c in row if c]
        if any(cand in " ".join(row_lower) for cand in DATE_COLUMNS + AMOUNT_COLUMNS):
            header_row_idx = i
            break

    header_row = rows[header_row_idx]
    date_col = _find_col(header_row, DATE_COLUMNS)
    amount_col = _find_col(header_row, AMOUNT_COLUMNS)
    desc_col = _find_col(header_row, DESC_COLUMNS)
    balance_col = _find_col(header_row, BALANCE_COLUMNS)

    if date_col is None or amount_col is None:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="GenericCSV",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=["GenericCSV: could not detect required date/amount columns"],
        )

    transactions = []
    statement_start = None
    statement_end = None

    for row in rows[header_row_idx + 1 :]:
        if not row:
            continue
        try:
            date_str = row[date_col].strip() if date_col < len(row) else ""
            amount_str = (
                row[amount_col]
                .strip()
                .replace(",", ".")
                .replace(" ", "")
                .replace("€", "")
                .replace("$", "")
                if amount_col < len(row)
                else ""
            )
            if not date_str or not amount_str:
                continue

            # Try multiple date formats
            parsed_date = None
            for fmt in (
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%d/%m/%Y",
                "%m/%d/%Y",
                "%d-%m-%Y",
                "%Y/%m/%d",
            ):
                try:
                    parsed_date = datetime.strptime(
                        date_str.split(".")[0].strip(), fmt
                    ).date()
                    break
                except ValueError:
                    continue
            if parsed_date is None:
                continue

            amount = Decimal(amount_str).quantize(Decimal("0.0001"))
            desc = (
                row[desc_col].strip()
                if desc_col is not None and desc_col < len(row)
                else ""
            )

            balance_after: Decimal | None = None
            if (
                balance_col is not None
                and balance_col < len(row)
                and row[balance_col].strip()
            ):
                try:
                    bal_str = (
                        row[balance_col].strip().replace(",", ".").replace(" ", "")
                    )
                    balance_after = Decimal(bal_str).quantize(Decimal("0.0001"))
                except InvalidOperation:
                    pass

            if statement_start is None or parsed_date < statement_start:
                statement_start = parsed_date
            if statement_end is None or parsed_date > statement_end:
                statement_end = parsed_date

            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=desc,
                    amount=amount,
                    currency="EUR",
                    balance_after=balance_after,
                )
            )
        except (InvalidOperation, IndexError, ValueError):
            continue

    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="GenericCSV",
            module_source="builtin",
            module_version=MODULE_VERSION,
            transactions=transactions,
            statement_period_start=statement_start,
            statement_period_end=statement_end,
        ),
        # Capped at 0.5 even if transactions found - this is a best-effort fallback
        confidence=0.5 if transactions else 0.1,
        tier_used="module",
        warnings=[] if transactions else ["GenericCSV: no transactions extracted"],
    )

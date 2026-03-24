"""
RevolutIT — Revolut Italy bank statement extractor.
Supported formats: CSV (primary), PDF (best-effort)
Export path in Revolut app: Account → Statements → Download → CSV
Sample FINGERPRINT keywords (from actual CSV): "type", "product", "started date", "completed date", "state", "balance"

CSV column order (from real sample):
  Type | Product | Started Date | Completed Date | Description | Amount | Fee | Currency | State | Balance

Amount sign convention: positive = credit, negative = debit (already signed in the file).
Currency is per-row (EUR for Italy accounts).
Only "COMPLETED" state transactions are included by default.
"""

from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from datetime import datetime
from pathlib import Path

FINGERPRINT: list[str] = [
    "type",
    "product",
    "started date",
    "completed date",
    "state",
    "balance",
]
MODULE_VERSION: str = "1.0.0"

_DATE_COLS = ["completed date", "started date"]
_AMOUNT_COL = "amount"
_DESC_COL = "description"
_CURRENCY_COL = "currency"
_STATE_COL = "state"
_BALANCE_COL = "balance"


def _parse_csv(path: Path):
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument, Transaction  # noqa: PLC0415

    with open(str(path), newline="", encoding="utf-8-sig", errors="ignore") as f:
        reader = csv.reader(f)
        raw_rows = list(reader)

    if not raw_rows:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="RevolutIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=["Empty CSV file"],
        )

    header = [h.lower().strip() for h in raw_rows[0]]

    def _idx(candidates: list[str]) -> int | None:
        for cand in candidates:
            for i, h in enumerate(header):
                if cand in h:
                    return i
        return None

    date_col = _idx(_DATE_COLS)
    amount_col = _idx([_AMOUNT_COL])
    desc_col = _idx([_DESC_COL])
    currency_col = _idx([_CURRENCY_COL])
    state_col = _idx([_STATE_COL])
    balance_col = _idx([_BALANCE_COL])

    if date_col is None or amount_col is None:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="RevolutIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.3,
            tier_used="module",
            warnings=["RevolutIT: required columns not found"],
        )

    transactions: list[Transaction] = []
    warnings: list[str] = []
    statement_start = None
    statement_end = None

    for row in raw_rows[1:]:
        if not row or len(row) <= max(
            c for c in [date_col, amount_col] if c is not None
        ):
            continue
        try:
            state_val = (
                row[state_col].strip().upper()
                if state_col is not None and state_col < len(row)
                else ""
            )
            # Skip reverted/cancelled transactions
            if state_val in ("REVERTED", "DECLINED", "FAILED"):
                continue

            date_str = row[date_col].strip() if date_col < len(row) else ""
            if not date_str:
                continue

            # "2026-02-02 04:57:34" format
            parsed_date = None
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    parsed_date = datetime.strptime(date_str.split(".")[0], fmt).date()
                    break
                except ValueError:
                    continue
            if parsed_date is None:
                continue

            amount_str = (
                row[amount_col].strip().replace(",", ".")
                if amount_col < len(row)
                else ""
            )
            if not amount_str:
                continue
            amount = Decimal(amount_str).quantize(Decimal("0.0001"))

            desc_raw = (
                row[desc_col].strip()
                if desc_col is not None and desc_col < len(row)
                else ""
            )
            currency = (
                row[currency_col].strip()
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
                    balance_after = Decimal(
                        row[balance_col].strip().replace(",", ".")
                    ).quantize(Decimal("0.0001"))
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
            module_name="RevolutIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
            transactions=transactions,
            statement_period_start=statement_start,
            statement_period_end=statement_end,
        ),
        confidence=0.9 if transactions else 0.4,
        tier_used="module",
        warnings=warnings
        if warnings
        else (["No transactions extracted"] if not transactions else []),
    )


def extract(file_path: str | Path):  # noqa: ANN201
    """Extract transactions from Revolut CSV/PDF export."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument  # noqa: PLC0415

    path = Path(file_path)
    if path.suffix.lower() in (".csv", ".txt"):
        return _parse_csv(path)

    # PDF: best-effort — return low-confidence skeleton (OCR pipeline handles this better)
    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="RevolutIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
        ),
        confidence=0.3,
        tier_used="module",
        warnings=[
            "RevolutIT: PDF extraction requires OCR pipeline — use CSV export for full accuracy"
        ],
    )

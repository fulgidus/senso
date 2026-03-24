"""
SatispayIT — Satispay Italy payment history extractor.
Supported formats: XLSX (primary), PDF (best-effort)
Export path in Satispay app: Profilo → Storico → Esporta
Sample FINGERPRINT keywords (from actual XLSX): "satispay", "date", "name", "balance after transaction", "meal vouchers"

XLSX column order (from real sample, row 0 is the header):
  Date | Name | Description | Amount | Type | Status | Balance | Meal Vouchers | Balance after transaction | ID

Amount sign: negative = payment out, positive = top-up/incoming.
Status values: "✅ Approved", "❌ Canceled" — only Approved transactions are included.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path

FINGERPRINT: list[str] = [
    "satispay",
    "balance after transaction",
    "meal vouchers",
    "to a store",
    "from bank",
]
MODULE_VERSION: str = "1.0.0"


def _parse_xlsx(path: Path):
    import openpyxl  # noqa: PLC0415
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument, Transaction  # noqa: PLC0415

    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    try:
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
    finally:
        wb.close()

    if not rows:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="SatispayIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.1,
            tier_used="module",
            warnings=["Empty XLSX file"],
        )

    # Header is row 0: Date | Name | Description | Amount | Type | Status | Balance | Meal Vouchers | Balance after transaction | ID
    header = [str(c).lower().strip() if c is not None else "" for c in rows[0]]

    def _idx(candidates: list[str]) -> int | None:
        for cand in candidates:
            for i, h in enumerate(header):
                if cand in h:
                    return i
        return None

    date_col = _idx(["date"])
    name_col = _idx(["name"])
    desc_col = _idx(["description"])
    amount_col = _idx(["amount"])
    status_col = _idx(["status"])
    balance_after_col = _idx(["balance after transaction"])

    if date_col is None or amount_col is None:
        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="SatispayIT",
                module_source="builtin",
                module_version=MODULE_VERSION,
            ),
            confidence=0.3,
            tier_used="module",
            warnings=["SatispayIT: required columns not found"],
        )

    transactions = []
    statement_start = None
    statement_end = None

    for row in rows[1:]:
        if not row or all(c is None for c in row):
            continue
        try:
            # Skip cancelled transactions
            status_raw = (
                str(row[status_col]).strip()
                if status_col is not None
                and status_col < len(row)
                and row[status_col] is not None
                else ""
            )
            if "cancel" in status_raw.lower() or "❌" in status_raw:
                continue

            date_val = row[date_col] if date_col < len(row) else None
            if date_val is None:
                continue

            if hasattr(date_val, "date"):
                txn_date = date_val.date()
            elif isinstance(date_val, str):
                from datetime import datetime  # noqa: PLC0415

                for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d"):
                    try:
                        txn_date = datetime.strptime(
                            date_val.strip().split(".")[0], fmt
                        ).date()
                        break
                    except ValueError:
                        continue
                else:
                    continue
            else:
                continue

            amount_raw = row[amount_col] if amount_col < len(row) else None
            if amount_raw is None:
                continue
            amount = Decimal(str(amount_raw)).quantize(Decimal("0.0001"))

            # Build description from Name + Description columns
            name_raw = (
                str(row[name_col]).strip()
                if name_col is not None
                and name_col < len(row)
                and row[name_col] is not None
                else ""
            )
            desc_raw = (
                str(row[desc_col]).strip()
                if desc_col is not None
                and desc_col < len(row)
                and row[desc_col] is not None
                else ""
            )
            description = f"{name_raw} {desc_raw}".strip() if desc_raw else name_raw

            balance_after: Decimal | None = None
            if (
                balance_after_col is not None
                and balance_after_col < len(row)
                and row[balance_after_col] is not None
            ):
                try:
                    balance_after = Decimal(str(row[balance_after_col])).quantize(
                        Decimal("0.0001")
                    )
                except InvalidOperation:
                    pass

            if statement_start is None or txn_date < statement_start:
                statement_start = txn_date
            if statement_end is None or txn_date > statement_end:
                statement_end = txn_date

            transactions.append(
                Transaction(
                    date=txn_date,
                    description=description,
                    amount=amount,
                    currency="EUR",
                    balance_after=balance_after,
                )
            )
        except (InvalidOperation, IndexError, TypeError):
            continue

    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="SatispayIT",
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
    """Extract payment history from Satispay XLSX/PDF export."""
    from app.schemas.ingestion import ExtractionResult, ExtractedDocument  # noqa: PLC0415

    path = Path(file_path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        return _parse_xlsx(path)

    # PDF: return low-confidence skeleton — OCR pipeline handles this better
    return ExtractionResult(
        document=ExtractedDocument(
            document_type="bank_statement",
            module_name="SatispayIT",
            module_source="builtin",
            module_version=MODULE_VERSION,
        ),
        confidence=0.3,
        tier_used="module",
        warnings=[
            "SatispayIT: PDF extraction requires OCR pipeline — use XLSX export for full accuracy"
        ],
    )

"""
Tests for Phase 18: non-ledger extraction modules (payslip, utility bill, invoice, receipt).
"""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Payslip
# ---------------------------------------------------------------------------

PAYSLIP_TEXT = """
BUSTA PAGA - CEDOLINO PAGA
Datore di Lavoro: Acme S.r.l.
Mese di Marzo 2025

Retribuzione Lorda: 2.500,00
INPS: 219,75
IRPEF: 412,50
Netto a Pagare: 1.867,75
"""


def test_payslip_extracts_net_income(tmp_path):
    from app.ingestion.modules.builtin.payslip_it import extract
    f = tmp_path / "payslip.txt"
    f.write_text(PAYSLIP_TEXT)
    result = extract(f, raw_text=PAYSLIP_TEXT)
    assert result["document_type"] == "payslip"
    assert result["net_income"] is not None
    assert float(result["net_income"]) == pytest.approx(1867.75)


def test_payslip_extracts_employer(tmp_path):
    from app.ingestion.modules.builtin.payslip_it import extract
    f = tmp_path / "payslip.txt"
    f.write_text(PAYSLIP_TEXT)
    result = extract(f, raw_text=PAYSLIP_TEXT)
    assert result["employer"] is not None
    assert "Acme" in result["employer"]


def test_payslip_no_transactions(tmp_path):
    from app.ingestion.modules.builtin.payslip_it import extract
    f = tmp_path / "payslip.txt"
    f.write_text(PAYSLIP_TEXT)
    result = extract(f, raw_text=PAYSLIP_TEXT)
    assert result["transactions"] == []


# ---------------------------------------------------------------------------
# Utility bill
# ---------------------------------------------------------------------------

UTILITY_TEXT = """
ENEL Energia S.p.A.
Bolletta Luce

Codice Cliente: ENL-123456
Importo Dovuto: 87,43
kWh consumati: 350
"""


def test_utility_bill_extracts_provider(tmp_path):
    from app.ingestion.modules.builtin.utility_bill_it import extract
    f = tmp_path / "bolletta.txt"
    f.write_text(UTILITY_TEXT)
    result = extract(f, raw_text=UTILITY_TEXT)
    assert result["document_type"] == "utility_bill"
    assert result["provider"] == "ENEL"


def test_utility_bill_extracts_total(tmp_path):
    from app.ingestion.modules.builtin.utility_bill_it import extract
    f = tmp_path / "bolletta.txt"
    f.write_text(UTILITY_TEXT)
    result = extract(f, raw_text=UTILITY_TEXT)
    assert result["total_due"] is not None
    assert float(result["total_due"]) == pytest.approx(87.43)


def test_utility_bill_service_type_luce(tmp_path):
    from app.ingestion.modules.builtin.utility_bill_it import extract
    f = tmp_path / "bolletta.txt"
    f.write_text(UTILITY_TEXT)
    result = extract(f, raw_text=UTILITY_TEXT)
    assert result["service_type"] == "luce"


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

INVOICE_TEXT = """
FATTURA N. 2025/042
Fornitore: Supplier S.r.l.
Partita IVA: IT12345678901

Imponibile: 1.000,00
Totale IVA 22%: 220,00
Totale Fattura EUR: 1.220,00

Data Scadenza: 30/04/2025
"""


def test_invoice_extracts_total(tmp_path):
    from app.ingestion.modules.builtin.invoice_it import extract
    f = tmp_path / "fattura.txt"
    f.write_text(INVOICE_TEXT)
    result = extract(f, raw_text=INVOICE_TEXT)
    assert result["document_type"] == "invoice"
    assert result["total_amount"] is not None
    assert float(result["total_amount"]) == pytest.approx(1220.0)


def test_invoice_extracts_merchant(tmp_path):
    from app.ingestion.modules.builtin.invoice_it import extract
    f = tmp_path / "fattura.txt"
    f.write_text(INVOICE_TEXT)
    result = extract(f, raw_text=INVOICE_TEXT)
    assert result["merchant"] is not None


# ---------------------------------------------------------------------------
# Receipt
# ---------------------------------------------------------------------------

RECEIPT_TEXT = """
Supermercato Roma
Via delle Vigne 12
P.IVA 01234567890

Pane integrale        1,50
Latte fresco          1,20
Pasta 500g            0,89

TOTALE EUR   3,59
15/03/2025
"""


def test_receipt_extracts_total(tmp_path):
    from app.ingestion.modules.builtin.receipt_it import extract
    f = tmp_path / "scontrino.txt"
    f.write_text(RECEIPT_TEXT)
    result = extract(f, raw_text=RECEIPT_TEXT)
    assert result["document_type"] == "receipt"
    assert result["total_amount"] is not None
    assert float(result["total_amount"]) == pytest.approx(3.59)


def test_receipt_extracts_merchant(tmp_path):
    from app.ingestion.modules.builtin.receipt_it import extract
    f = tmp_path / "scontrino.txt"
    f.write_text(RECEIPT_TEXT)
    result = extract(f, raw_text=RECEIPT_TEXT)
    assert result["merchant"] is not None
    assert "Supermercato" in result["merchant"]


def test_receipt_no_transactions(tmp_path):
    from app.ingestion.modules.builtin.receipt_it import extract
    f = tmp_path / "scontrino.txt"
    f.write_text(RECEIPT_TEXT)
    result = extract(f, raw_text=RECEIPT_TEXT)
    assert result["transactions"] == []

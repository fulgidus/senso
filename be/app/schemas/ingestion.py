from decimal import Decimal
from datetime import date
from typing import Literal
from pydantic import BaseModel, Field


class LineItem(BaseModel):
    label: str
    amount: Decimal


class Transaction(BaseModel):
    date: date
    description: str
    amount: Decimal  # negative = debit, positive = credit
    currency: str = "EUR"
    category_hint: str | None = None
    balance_after: Decimal | None = None


class ExtractedDocument(BaseModel):
    document_type: Literal[
        "bank_statement",
        "payslip",
        "receipt",
        "invoice",
        "f24_tax_form",
        "road_fine",
        "certificato_unico",
        "utility_bill",
        "unknown",
    ]
    module_name: str | None = None
    module_source: Literal["builtin", "generated", "promoted"] | None = None
    module_version: str | None = None

    # bank_statement fields
    transactions: list[Transaction] = []
    account_holder: str | None = None
    account_iban: str | None = None
    statement_period_start: date | None = None
    statement_period_end: date | None = None

    # payslip fields
    employer: str | None = None
    employee_name: str | None = None
    pay_period_start: date | None = None
    pay_period_end: date | None = None
    gross_income: Decimal | None = None
    net_income: Decimal | None = None
    currency: str = "EUR"
    deductions: list[LineItem] = []

    # receipt fields
    merchant: str | None = None
    purchase_date: date | None = None
    total_amount: Decimal | None = None
    line_items: list[LineItem] = []

    # utility_bill fields
    provider: str | None = None
    service_type: str | None = None
    billing_period_start: date | None = None
    billing_period_end: date | None = None
    total_due: Decimal | None = None
    account_number: str | None = None


class ExtractionResult(BaseModel):
    document: ExtractedDocument
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    raw_text: str | None = None
    tier_used: Literal[
        # legacy / generic
        "module",
        "ocr_text",
        "llm_text",
        "llm_vision",
        "adaptive",
        # PDF-specific
        "pdf_text_layer",
        "pdf_text_layer_module",
        "pdf_adaptive_module",
        "pdf_llm_text",
        "pdf_llm_vision",
        # image-specific
        "image_ocr_module",
        "image_llm_text",
        "image_llm_vision",
    ] = "module"
    warnings: list[str] = []


# API DTOs
class UploadStatusDTO(BaseModel):
    id: str
    original_filename: str = Field(alias="originalFilename")
    content_type: str = Field(alias="contentType")
    size_bytes: int = Field(alias="sizeBytes")
    uploaded_at: str = Field(alias="uploadedAt")
    extraction_status: str = Field(alias="extractionStatus")
    extraction_method: str | None = Field(alias="extractionMethod", default=None)
    module_source: str | None = Field(alias="moduleSource", default=None)
    confirmed: bool = False
    report_flagged: bool = Field(alias="reportFlagged", default=False)
    error_message: str | None = Field(alias="errorMessage", default=None)

    model_config = {"populate_by_name": True}


class RetryRequest(BaseModel):
    hint: str | None = None


class ReportRequest(BaseModel):
    note: str | None = None


class ModuleInfo(BaseModel):
    name: str
    source: Literal["builtin", "generated", "promoted"]
    version: str
    fingerprint: list[str]
    is_new: bool = False  # True for source="generated" not yet promoted

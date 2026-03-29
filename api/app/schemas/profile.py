from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel, Field, field_validator


IncomeSourceType = Literal[
    "employment_net",  # user enters monthly net directly
    "employment_gross",  # RAL + Italian payroll computation
    "self_employment",  # freelance / P.IVA
    "rental",
    "investment_dividends",
    "pension",
    "benefits",
    "family_support",
    "other",
]


class IncomeSource(BaseModel):
    """Rich income source object - replaces the old list[str] income_sources."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    type: IncomeSourceType = "employment_net"
    currency: str = "EUR"

    # --- value range ---
    # is_fixed=True means value_min == value_max → single input in UI
    is_fixed: bool = Field(alias="isFixed", default=True)
    value_min: float = Field(alias="valueMin", default=0.0)
    value_max: float = Field(alias="valueMax", default=0.0)

    # --- hours / overtime (optional, per CCNL) ---
    weekly_hours: float | None = Field(alias="weeklyHours", default=None)
    overtime_weekly_hours_min: float | None = Field(
        alias="overtimeWeeklyHoursMin", default=None
    )
    overtime_weekly_hours_max: float | None = Field(
        alias="overtimeWeeklyHoursMax", default=None
    )
    overtime_multiplier: float | None = Field(alias="overtimeMultiplier", default=None)

    # --- transaction matching ---
    transaction_labels: list[str] = Field(
        alias="transactionLabels", default_factory=list
    )
    transaction_labels_case_sensitive: bool = Field(
        alias="transactionLabelsCaseSensitive", default=False
    )

    # --- visibility ---
    hide_from_graphs: bool = Field(alias="hideFromGraphs", default=False)
    hide_from_assistant: bool = Field(alias="hideFromAssistant", default=False)

    # --- Italian employment-specific (type == "employment_gross") ---
    ral: float | None = None  # Reddito Annuo Lordo
    ccnl_id: str | None = Field(alias="ccnlId", default=None)
    extra_months: int | None = Field(alias="extraMonths", default=None)  # 13 or 14
    production_bonus_annual: float | None = Field(
        alias="productionBonusAnnual", default=None
    )
    welfare_annual: float | None = Field(alias="welfareAnnual", default=None)
    meal_voucher_face_value: float | None = Field(
        alias="mealVoucherFaceValue", default=None
    )
    meal_voucher_estimated_days_month: float | None = Field(
        alias="mealVoucherEstimatedDaysMonth", default=None
    )
    meal_voucher_electronic: bool = Field(alias="mealVoucherElectronic", default=True)

    model_config = {"populate_by_name": True}


class InsightCard(BaseModel):
    headline: str
    data_point: str
    educational_framing: str = Field(alias="educationalFraming")

    model_config = {"populate_by_name": True}


class IncomeSummary(BaseModel):
    amount: float
    currency: str = "EUR"
    source: Literal["payslip", "questionnaire", "estimated_from_transactions"] = Field(
        alias="source"
    )

    model_config = {"populate_by_name": True}


class UserProfileDTO(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    income_summary: dict | None = Field(alias="incomeSummary", default=None)
    monthly_expenses: float | None = Field(alias="monthlyExpenses", default=None)
    monthly_margin: float | None = Field(alias="monthlyMargin", default=None)
    category_totals: dict = Field(alias="categoryTotals", default_factory=dict)
    insight_cards: list[dict] = Field(alias="insightCards", default_factory=list)
    coaching_insights: list[dict] = Field(
        alias="coachingInsights", default_factory=list
    )
    questionnaire_answers: dict | None = Field(
        alias="questionnaireAnswers", default=None
    )
    data_sources: list[str] = Field(alias="dataSources", default_factory=list)
    confirmed: bool = False
    profile_generated_at: str | None = Field(alias="profileGeneratedAt", default=None)
    updated_at: str = Field(alias="updatedAt")
    # New fields (C + A) - optional so existing clients don't break
    extraordinary_income_total: float | None = Field(
        alias="extraordinaryIncomeTotal", default=None
    )
    months_covered: float | None = Field(alias="monthsCovered", default=None)

    model_config = {"populate_by_name": True}


class CategorizationStatusDTO(BaseModel):
    status: Literal[
        "queued",
        "categorizing",
        "generating_insights",
        "complete",
        "failed",
        "not_started",
    ]
    error_message: str | None = Field(alias="errorMessage", default=None)
    started_at: str | None = Field(alias="startedAt", default=None)
    completed_at: str | None = Field(alias="completedAt", default=None)
    # Fingerprint of uploads at last categorization vs. current confirmed uploads.
    # If they differ, the profile is stale and re-categorization is recommended.
    uploads_fingerprint: str | None = Field(alias="uploadsFingerprint", default=None)
    current_uploads_fingerprint: str | None = Field(
        alias="currentUploadsFingerprint", default=None
    )
    # Granular per-file progress populated during a categorization run.
    # Shape: {"files": [...], "txn_total": int, "txn_categorised": int, "current_step_detail": str}
    progress_detail: dict | None = Field(alias="progressDetail", default=None)

    model_config = {"populate_by_name": True}


class QuestionnaireAnswers(BaseModel):
    # Quick (required)
    employment_type: Literal["employed", "self_employed", "student", "other"] = Field(
        alias="employmentType"
    )
    # Free-text clarification when employment_type == "other"
    job_other: str | None = Field(alias="jobOther", default=None)
    monthly_net_income: float = Field(alias="monthlyNetIncome")
    currency: str = "EUR"
    # Income sources - rich objects (replaces old list[str])
    income_sources: list[IncomeSource] = Field(
        alias="incomeSources", default_factory=list
    )
    # Expenses by category: {"Affitto": 800, "Cibo": 400, ...}
    expense_categories: dict[str, float] = Field(
        alias="expenseCategories", default_factory=dict
    )
    # Thorough extras (optional)
    fixed_monthly_costs: float | None = Field(alias="fixedMonthlyCosts", default=None)
    other_income_sources: list[str] = Field(
        alias="otherIncomeSources", default_factory=list
    )
    household_size: int | None = Field(alias="householdSize", default=None)
    savings_behavior: Literal["not_saving", "occasional", "regular"] | None = Field(
        alias="savingsBehavior", default=None
    )
    financial_goal: Literal["save_more", "reduce_debt", "just_track"] | None = Field(
        alias="financialGoal", default=None
    )

    model_config = {"populate_by_name": True}


class ProfileConfirmRequest(BaseModel):
    income_override: float | None = Field(alias="incomeOverride", default=None)
    expenses_override: float | None = Field(alias="expensesOverride", default=None)
    income_source_override: str | None = Field(
        alias="incomeSourceOverride", default=None
    )

    model_config = {"populate_by_name": True}


class QuestionnaireSubmitRequest(BaseModel):
    answers: QuestionnaireAnswers
    mode: Literal["quick", "thorough"] = "quick"

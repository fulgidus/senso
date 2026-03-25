from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


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
    questionnaire_answers: dict | None = Field(
        alias="questionnaireAnswers", default=None
    )
    data_sources: list[str] = Field(alias="dataSources", default_factory=list)
    confirmed: bool = False
    profile_generated_at: str | None = Field(alias="profileGeneratedAt", default=None)
    updated_at: str = Field(alias="updatedAt")

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

    model_config = {"populate_by_name": True}


class QuestionnaireAnswers(BaseModel):
    # Quick (3 questions)
    employment_type: Literal["employed", "self_employed", "student", "other"] = Field(
        alias="employmentType"
    )
    monthly_net_income: float = Field(alias="monthlyNetIncome")
    currency: str = "EUR"
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

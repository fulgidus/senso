"""
ProfileService: profile retrieval, questionnaire saving, confirm/correct, and categorization trigger.
"""

import hashlib
from datetime import UTC, datetime

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.db.repository import (
    get_categorization_job,
    get_confirmed_upload_ids,
    get_user_profile,
    upsert_categorization_job,
    upsert_user_profile,
)
from app.db.models import UserProfile
from app.ingestion.llm import get_llm_client
from app.schemas.profile import CategorizationStatusDTO, UserProfileDTO


class ProfileError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ProfileService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_profile(self, user_id: str) -> UserProfileDTO:
        profile = get_user_profile(self.db, user_id)
        if not profile:
            raise ProfileError(
                "not_found", "Profile not yet generated", status_code=404
            )
        return self._to_dto(profile)

    def get_status(self, user_id: str) -> CategorizationStatusDTO:
        job = get_categorization_job(self.db, user_id)
        # Compute current fingerprint from confirmed uploads (always)
        confirmed_ids = get_confirmed_upload_ids(self.db, user_id)
        current_fp = (
            hashlib.sha256(",".join(confirmed_ids).encode()).hexdigest()
            if confirmed_ids
            else None
        )
        # Stored fingerprint from the last completed categorization
        profile = get_user_profile(self.db, user_id)
        stored_fp = profile.uploads_fingerprint if profile else None

        if not job:
            return CategorizationStatusDTO(
                status="not_started",
                uploadsFingerprint=stored_fp,
                currentUploadsFingerprint=current_fp,
            )
        return CategorizationStatusDTO(
            status=job.status,
            errorMessage=job.error_message,
            startedAt=job.started_at.isoformat() if job.started_at else None,
            completedAt=job.completed_at.isoformat() if job.completed_at else None,
            uploadsFingerprint=stored_fp,
            currentUploadsFingerprint=current_fp,
            progressDetail=job.progress_detail,
        )

    def save_questionnaire(self, user_id: str, answers: dict) -> dict:
        # Eagerly derive financial fields from questionnaire so coaching sees real data
        # even before a full document ingestion + categorization run.
        updates: dict = {"questionnaire_answers": answers}

        # --- income sources (new rich object model) ---
        income_sources: list[dict] = (
            answers.get("incomeSources") or answers.get("income_sources", []) or []
        )

        # Derive monthly_net_income: sum value_min of non-hidden sources
        # For employment_gross sources, value_min should already be the computed net
        # (frontend handles the IRPEF computation and sets value_min/value_max).
        total_net_min = 0.0
        total_net_max = 0.0
        for src in income_sources:
            if not src.get("hideFromAssistant", src.get("hide_from_assistant", False)):
                v_min = float(src.get("valueMin") or src.get("value_min") or 0.0)
                v_max = float(src.get("valueMax") or src.get("value_max") or v_min)
                total_net_min += v_min
                total_net_max += v_max

        # Fallback to old scalar field if no income sources provided
        monthly_net_income = answers.get("monthlyNetIncome") or answers.get(
            "monthly_net_income"
        )
        if income_sources:
            monthly_net_income = total_net_min  # use min (conservative)

        employment_type = answers.get("employmentType") or answers.get(
            "employment_type", "questionnaire"
        )
        currency = answers.get("currency", "EUR")
        fixed_monthly_costs = answers.get("fixedMonthlyCosts") or answers.get(
            "fixed_monthly_costs"
        )
        expense_categories: dict = (
            answers.get("expenseCategories")
            or answers.get("expense_categories", {})
            or {}
        )

        # Derive total monthly expenses from per-category breakdown when provided
        if expense_categories:
            fixed_monthly_costs = sum(float(v) for v in expense_categories.values())
            updates["category_totals"] = {
                k: float(v) for k, v in expense_categories.items()
            }

        if monthly_net_income is not None:
            updates["income_summary"] = {
                "amount": float(monthly_net_income),
                "amount_max": round(total_net_max, 2) if income_sources else None,
                "currency": currency,
                "source": "questionnaire",
                "employment_type": employment_type,
                "income_sources_count": len(income_sources),
            }
            if fixed_monthly_costs is not None:
                updates["monthly_expenses"] = float(fixed_monthly_costs)
                updates["monthly_margin"] = float(monthly_net_income) - float(
                    fixed_monthly_costs
                )

        # Questionnaire completion confirms the profile - user can now access the coach.
        updates["confirmed"] = True
        updates["updated_at"] = datetime.now(UTC)
        upsert_user_profile(self.db, user_id, **updates)
        return {"status": "saved"}

    def confirm_profile(
        self,
        user_id: str,
        income_override: float | None,
        expenses_override: float | None,
        income_source_override: str | None,
    ) -> UserProfileDTO:
        profile = get_user_profile(self.db, user_id)
        if not profile:
            raise ProfileError(
                "not_found", "Profile not yet generated", status_code=404
            )

        updates: dict = {"confirmed": True, "updated_at": datetime.now(UTC)}
        if income_override is not None:
            income_summary = dict(profile.income_summary or {})
            income_summary["amount"] = income_override
            if income_source_override:
                income_summary["source"] = income_source_override
            updates["income_summary"] = income_summary
            if profile.monthly_expenses is not None:
                updates["monthly_margin"] = income_override - profile.monthly_expenses
        if expenses_override is not None:
            updates["monthly_expenses"] = expenses_override
            income_amt = (
                updates.get("income_summary") or profile.income_summary or {}
            ).get("amount")
            if income_amt is not None:
                updates["monthly_margin"] = income_amt - expenses_override

        upsert_user_profile(self.db, user_id, **updates)
        return self.get_profile(user_id)

    def trigger_categorization_for_user(
        self, user_id: str, background_tasks: BackgroundTasks
    ) -> dict:
        """Create/reset the categorization job and queue background work."""
        upsert_categorization_job(
            self.db,
            user_id,
            status="queued",
            error_message=None,
            started_at=None,
            completed_at=None,
            created_at=datetime.now(UTC),
        )
        self.db.commit()

        # IMPORTANT: the background task must open its OWN DB session.
        # Reusing self.db (the request-scoped session) causes the task to hang
        # because FastAPI closes the session after the response is sent.
        def _run_in_own_session() -> None:
            from app.db.session import SessionLocal
            from app.services.categorization_service import CategorizationService

            db = SessionLocal()
            try:
                llm_client = get_llm_client()
                svc = CategorizationService(db=db, llm_client=llm_client)
                svc.run_categorization(user_id=user_id)
            finally:
                db.close()

        background_tasks.add_task(_run_in_own_session)
        return {"status": "queued"}

    def _to_dto(self, profile) -> UserProfileDTO:
        return UserProfileDTO(
            id=profile.id,
            userId=profile.user_id,
            incomeSummary=profile.income_summary,
            monthlyExpenses=profile.monthly_expenses,
            monthlyMargin=profile.monthly_margin,
            categoryTotals=profile.category_totals or {},
            insightCards=profile.insight_cards or [],
            coachingInsights=profile.coaching_insights or [],
            questionnaireAnswers=profile.questionnaire_answers,
            dataSources=profile.data_sources or [],
            confirmed=profile.confirmed,
            profileGeneratedAt=profile.profile_generated_at.isoformat()
            if profile.profile_generated_at
            else None,
            updatedAt=profile.updated_at.isoformat(),
            extraordinaryIncomeTotal=profile.extraordinary_income_total,
            monthsCovered=profile.months_covered,
        )

    # ── Phase 18: Non-ledger document profile enrichment ─────────────────────

    def enrich_from_extraction(self, user_id: str, extraction) -> None:
        """Unified dispatcher: routes to the correct enrichment method by document_type."""
        dispatch = {
            "payslip": self.enrich_from_payslip,
            "utility_bill": self.enrich_from_utility_bill,
            "invoice": self.enrich_from_invoice,
            "receipt": self.enrich_from_receipt,
        }
        fn = dispatch.get(getattr(extraction, "document_type", None))
        if fn:
            fn(user_id, extraction)
        # bank_statement and unknown: no enrichment (transactions handled separately)

    def enrich_from_payslip(self, user_id: str, extraction) -> None:
        """Append payslip data to verified_income_sources and update income range."""
        from datetime import datetime, UTC as _UTC

        profile = self.db.query(UserProfile).filter_by(user_id=user_id).first()
        if profile is None:
            return

        sources = list(profile.verified_income_sources or [])
        entry = {
            "net_income": float(extraction.net_income) if extraction.net_income else None,
            "gross_income": float(extraction.gross_income) if extraction.gross_income else None,
            "employer": extraction.employer,
            "verified_at": datetime.now(_UTC).isoformat(),
        }
        sources.append(entry)
        profile.verified_income_sources = sources

        # Update monthly_income min/max from income_summary if net_income is available
        net = extraction.net_income
        if net is not None:
            summary = dict(profile.income_summary or {})
            current_min = summary.get("income_min")
            current_max = summary.get("income_max")
            net_f = float(net)
            if current_min is None or net_f < current_min:
                summary["income_min"] = net_f
            if current_max is None or net_f > current_max:
                summary["income_max"] = net_f
            profile.income_summary = summary

        profile.updated_at = datetime.now(_UTC)
        self.db.commit()

    def enrich_from_utility_bill(self, user_id: str, extraction) -> None:
        """Upsert utility bill into fixed_expenses (keyed by provider+service_type)."""
        from datetime import datetime, UTC as _UTC

        profile = self.db.query(UserProfile).filter_by(user_id=user_id).first()
        if profile is None:
            return

        expenses = list(profile.fixed_expenses or [])
        provider = extraction.provider or "Unknown"
        service = extraction.service_type or "utility"

        # Upsert: update existing entry for same provider+service, else append
        key = f"{provider}:{service}".lower()
        updated = False
        for i, exp in enumerate(expenses):
            if f"{exp.get('provider','')}:{exp.get('service_type','')}".lower() == key:
                expenses[i] = {
                    "provider": provider,
                    "service_type": service,
                    "monthly_amount": float(extraction.total_due) if extraction.total_due else None,
                    "updated_at": datetime.now(_UTC).isoformat(),
                }
                updated = True
                break
        if not updated:
            expenses.append({
                "provider": provider,
                "service_type": service,
                "monthly_amount": float(extraction.total_due) if extraction.total_due else None,
                "added_at": datetime.now(_UTC).isoformat(),
            })

        profile.fixed_expenses = expenses
        profile.updated_at = datetime.now(_UTC)
        self.db.commit()

    def enrich_from_invoice(self, user_id: str, extraction) -> None:
        """Append invoice to one_off_expenses."""
        from datetime import datetime, UTC as _UTC

        profile = self.db.query(UserProfile).filter_by(user_id=user_id).first()
        if profile is None:
            return

        expenses = list(profile.one_off_expenses or [])
        expenses.append({
            "vendor": getattr(extraction, "vendor", None) or getattr(extraction, "merchant", None),
            "total_amount": float(extraction.total_amount) if extraction.total_amount else None,
            "added_at": datetime.now(_UTC).isoformat(),
        })
        profile.one_off_expenses = expenses
        profile.updated_at = datetime.now(_UTC)
        self.db.commit()

    def enrich_from_receipt(self, user_id: str, extraction) -> None:
        """Append receipt to one_off_expenses."""
        from datetime import datetime, UTC as _UTC

        profile = self.db.query(UserProfile).filter_by(user_id=user_id).first()
        if profile is None:
            return

        expenses = list(profile.one_off_expenses or [])
        expenses.append({
            "merchant": extraction.merchant,
            "total_amount": float(extraction.total_amount) if extraction.total_amount else None,
            "added_at": datetime.now(_UTC).isoformat(),
        })
        profile.one_off_expenses = expenses
        profile.updated_at = datetime.now(_UTC)
        self.db.commit()

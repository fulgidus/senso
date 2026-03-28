"""
ProfileService: profile retrieval, questionnaire saving, confirm/correct, and categorization trigger.
"""

from datetime import UTC, datetime

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.db.repository import (
    get_categorization_job,
    get_user_profile,
    upsert_categorization_job,
    upsert_user_profile,
)
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
        if not job:
            return CategorizationStatusDTO(status="not_started")
        return CategorizationStatusDTO(
            status=job.status,
            errorMessage=job.error_message,
            startedAt=job.started_at.isoformat() if job.started_at else None,
            completedAt=job.completed_at.isoformat() if job.completed_at else None,
        )

    def save_questionnaire(self, user_id: str, answers: dict) -> dict:
        upsert_user_profile(self.db, user_id, questionnaire_answers=answers)
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

        from app.services.categorization_service import CategorizationService

        llm_client = get_llm_client()
        svc = CategorizationService(db=self.db, llm_client=llm_client)
        background_tasks.add_task(svc.run_categorization, user_id=user_id)
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

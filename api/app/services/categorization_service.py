"""
CategorizationService: rules-first / LLM-fallback transaction categorization + insight generation.
MANDATORY: Category taxonomy and tag vocabulary derived from real sample transaction analysis (D-07).
"""

import json
import logging
import re
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import CategorizationJob, Transaction, UserProfile
from app.db.repository import (
    get_categorization_job,
    get_confirmed_payslip_documents,
    get_confirmed_transactions_for_user,
    get_user_profile,
    seed_default_tags,
    upsert_categorization_job,
    upsert_user_profile,
)
from app.ingestion.llm import LLMClient, LLMError

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Category taxonomy — derived from real Italian bank/payment sample data (D-07)
# Keys are English snake_case; shown in UI as human-readable labels.
# ────────────────────────────────────────────────────────────────────
VALID_CATEGORIES = {
    "groceries",  # Supermarkets, food shops
    "dining",  # Restaurants, cafes, pizzerias
    "fast_food",  # McDonald's, Burger King, quick service
    "food_delivery",  # Just Eat, Glovo, Deliveroo, UberEats
    "transport",  # Taxi, rideshare, public transit, flights
    "housing",  # Rent, condo fees, maintenance
    "utilities",  # Electricity (Edison), gas, water
    "telecom",  # Phone, internet, TV (Fastweb, TIM, Vodafone)
    "subscriptions",  # Netflix, Spotify, Google, browser tools, SaaS
    "health",  # Pharmacy (Farmacia), medical, wellness
    "shopping",  # Clothing, electronics, general retail
    "personal_care",  # Hygiene products, beauty (Acqua & Sapone)
    "pets",  # Pet food, vet, supplies
    "tech_tools",  # APIs, hosting, developer tools (OVH, Openrouter, fal.ai, GitHub)
    "savings",  # Transfers to savings accounts, emergency funds
    "transfers",  # Person-to-person transfers, internal moves
    "income",  # Salary deposits, freelance income, payments received
    "interest",  # Interest earned on deposits
    "donations",  # Charitable contributions (Wikimedia)
    "uncategorized",  # Fallback when no rule or LLM match
}

# ────────────────────────────────────────────────────────────────────
# Rule engine — regex patterns derived from real transaction descriptions
# Order matters: more specific rules first. Case-insensitive.
# ────────────────────────────────────────────────────────────────────
CATEGORY_RULES: list[tuple[str, str, list[str]]] = [
    # (pattern, category, auto_tags)
    # --- Income signals ---
    (
        r"payment from .+|stipendio|busta paga|bonifico stipendio|salary|payroll",
        "income",
        ["work_income", "recurring"],
    ),
    (
        r"modalsource|s\.c\.i\.|sci cormor|freelance|fattura|compenso",
        "income",
        ["freelance_income"],
    ),
    (r"interest earned|interesse maturato", "interest", ["interest", "recurring"]),
    # --- Savings & internal transfers ---
    (
        r"to pocket|to instant access savings|pocket withdrawal|to .* savings|emergency",
        "savings",
        ["savings_transfer", "recurring"],
    ),
    (r"balance migration|closing transaction", "transfers", ["savings_transfer"]),
    # --- Person-to-person transfers ---
    (r"satispay europe|satispay", "transfers", ["peer_transfer"]),
    # --- Housing ---
    (
        r"condominio|amministrazione|affitto|rent|property management",
        "housing",
        ["recurring", "condominium"],
    ),
    # --- Utilities ---
    (
        r"edison|enel|a2a|iren|hera energia|gas|electricity|luce e gas|bolletta",
        "utilities",
        ["utility", "recurring"],
    ),
    # --- Telecom ---
    (
        r"fastweb|tim |telecom italia|vodafone|wind|iliad|ho mobile|fibra",
        "telecom",
        ["telecom", "recurring", "subscription"],
    ),
    # --- Tech subscriptions & tools ---
    (
        r"openrouter|fal\.ai|anthropic|openai|github|ovh|register\.it|aruba|hetzner|cloudflare",
        "tech_tools",
        ["tech_tools", "subscription"],
    ),
    (r"brave browser", "subscriptions", ["subscription"]),
    # --- General subscriptions ---
    (
        r"google pay|google payment|netflix|spotify|apple|amazon prime|disney|hbo|paramount",
        "subscriptions",
        ["subscription", "recurring"],
    ),
    # --- Food delivery ---
    (
        r"just eat|justeat|glovo|deliveroo|uber eats|ubereats|consegna a domicilio",
        "food_delivery",
        ["food_delivery"],
    ),
    # --- Fast food ---
    (
        r"mcdonald|burger king|kfc|domino|subway|pizza hut|five guys",
        "fast_food",
        ["fast_food"],
    ),
    # --- Dining ---
    (r"ristorante|pizzeria|trattoria|osteria|bistro|sushi|gelateria", "dining", []),
    # --- Transport ---
    (
        r"wetaxi|uber|italo|trenitalia|ryanair|easyjet|fly |blablacar|atm |gtt |tram|metro|taxi|autobus",
        "transport",
        ["transport"],
    ),
    # --- Health ---
    (
        r"farmacia|pharmacy|medico|dottore|dentista|clinica|ospedale|ottico|wellness",
        "health",
        ["health"],
    ),
    # --- Pets ---
    (r"pet torino|veterinario|animale|cane|gatto", "pets", ["pet"]),
    # --- Personal care ---
    (
        r"acqua e sapone|acqua & sapone|profumeria|coiffeur|parrucchiere|barbiere|igiene",
        "personal_care",
        ["personal_care"],
    ),
    # --- Shopping ---
    (
        r"lttstore|amazon|zalando|zara|h&m|ikea|leroy merlin|decathlon|mediaworld|euronics",
        "shopping",
        [],
    ),
    # --- Groceries ---
    (
        r"esselunga|carrefour|coop|lidl|aldi|auchan|conad|pam |eurospin|supermercato|grocery|alimentari",
        "groceries",
        [],
    ),
    # --- Donations ---
    (
        r"wikimedia|wikipedia|red cross|croce rossa|unicef|medici senza frontiere|donazione",
        "donations",
        ["donation"],
    ),
]


class CategorizationService:
    def __init__(self, db: Session, llm_client: LLMClient) -> None:
        self.db = db
        self.llm = llm_client

    def run_categorization(self, user_id: str) -> None:
        """Full categorization pipeline. Called as BackgroundTask after confirm-all."""
        # Ensure default tags exist
        seed_default_tags(self.db)

        # Update job to categorizing
        upsert_categorization_job(
            self.db,
            user_id,
            status="categorizing",
            started_at=datetime.now(UTC),
            error_message=None,
        )

        try:
            transactions = get_confirmed_transactions_for_user(self.db, user_id)
            if not transactions:
                # No transactions — build profile from questionnaire/payslip only
                self._finalize_profile(user_id, transactions)
                return

            # Step 1: Rules pass
            unmatched = []
            for txn in transactions:
                category, auto_tags = self._apply_rules(txn.description)
                if category:
                    txn.category = category
                    txn.tags = list(set(auto_tags + (txn.tags or [])))
                else:
                    unmatched.append(txn)

            self.db.commit()

            # Step 2: LLM fallback for unmatched transactions
            if unmatched:
                self._llm_classify_batch(unmatched)

            # Step 3: Generate insights
            upsert_categorization_job(self.db, user_id, status="generating_insights")
            self.db.commit()

            self._finalize_profile(user_id, transactions)

        except Exception as exc:
            logger.exception("Categorization failed for user %s: %s", user_id, exc)
            upsert_categorization_job(
                self.db,
                user_id,
                status="failed",
                error_message=str(exc),
                completed_at=datetime.now(UTC),
            )
            self.db.commit()

    def _apply_rules(self, description: str) -> tuple[str | None, list[str]]:
        """Rules-first classification. Returns (category, auto_tags) or (None, [])."""
        desc_lower = description.lower()
        for pattern, category, tags in CATEGORY_RULES:
            if re.search(pattern, desc_lower, re.IGNORECASE):
                return category, tags
        return None, []

    def _llm_classify_batch(self, transactions: list[Transaction]) -> None:
        """Send unmatched transactions to LLM in batches of 50."""
        BATCH_SIZE = 50
        valid_cats = sorted(VALID_CATEGORIES)

        for i in range(0, len(transactions), BATCH_SIZE):
            batch = transactions[i : i + BATCH_SIZE]
            items = [
                {"idx": j, "description": t.description, "amount": float(t.amount)}
                for j, t in enumerate(batch)
            ]
            prompt = (
                f"Classify each transaction into exactly one category from this list:\n"
                f"{valid_cats}\n\n"
                f"Return a JSON array with one object per transaction:\n"
                f'[{{"idx": 0, "category": "...", "tags": []}}, ...]\n\n'
                f"Tags must be from: recurring, subscription, food_delivery, fast_food, "
                f"peer_transfer, savings_transfer, refund, work_income, freelance_income, "
                f"interest, utility, telecom, hosting, tech_tools, transport, pet, health, "
                f"donation, condominium\n\n"
                f"Transactions:\n{json.dumps(items, ensure_ascii=False)}"
            )
            try:
                raw = self.llm.complete(
                    prompt=prompt,
                    system="You are a financial transaction classifier. Respond only with valid JSON.",
                    json_mode=True,
                    timeout=30.0,
                )
                results = json.loads(raw)
                for item in results:
                    idx = item.get("idx")
                    if idx is None or idx >= len(batch):
                        continue
                    txn = batch[idx]
                    cat = item.get("category", "uncategorized")
                    if cat not in VALID_CATEGORIES:
                        cat = "uncategorized"
                    txn.category = cat
                    txn.tags = list(set(item.get("tags", []) + (txn.tags or [])))
            except (LLMError, json.JSONDecodeError, Exception) as exc:
                logger.warning("LLM batch classification failed: %s", exc)
                # D-10: mark unclassified as uncategorized, don't fail the job
                for txn in batch:
                    if not txn.category:
                        txn.category = "uncategorized"

        self.db.commit()

    def _finalize_profile(self, user_id: str, transactions: list[Transaction]) -> None:
        """Compute summary stats, generate insights, save UserProfile."""
        # Compute category totals (expenses only)
        category_totals: dict[str, float] = {}
        for txn in transactions:
            if txn.type == "expense" and txn.category and txn.category != "transfers":
                cat = txn.category or "uncategorized"
                category_totals[cat] = category_totals.get(cat, 0.0) + abs(
                    float(txn.amount)
                )

        # Compute income summary (D-19 priority chain)
        income_summary = self._compute_income(user_id, transactions)

        # Compute total monthly expenses
        total_expenses = sum(category_totals.values())

        # Compute margin
        monthly_margin = None
        if income_summary:
            monthly_margin = income_summary["amount"] - total_expenses

        # Determine data sources
        data_sources = []
        if any(t.type == "income" for t in transactions):
            data_sources.append("bank_statement")
        payslips = get_confirmed_payslip_documents(self.db, user_id)
        if payslips:
            data_sources.append("payslip")

        existing_profile = get_user_profile(self.db, user_id)
        if existing_profile and existing_profile.questionnaire_answers:
            data_sources.append("questionnaire")

        # Generate LLM insight cards
        insight_cards = self._generate_insights(
            category_totals, income_summary, transactions
        )

        upsert_user_profile(
            self.db,
            user_id,
            income_summary=income_summary,
            monthly_expenses=total_expenses,
            monthly_margin=monthly_margin,
            category_totals=category_totals,
            insight_cards=insight_cards,
            data_sources=list(set(data_sources)),
            profile_generated_at=datetime.now(UTC),
        )

        upsert_categorization_job(
            self.db,
            user_id,
            status="complete",
            completed_at=datetime.now(UTC),
        )
        self.db.commit()

    def _compute_income(
        self, user_id: str, transactions: list[Transaction]
    ) -> dict | None:
        """D-19: payslip → questionnaire → estimated from transactions."""
        # Priority 1: payslip net_income
        payslips = get_confirmed_payslip_documents(self.db, user_id)
        if payslips:
            for p in payslips:
                payload = p.payload_json or {}
                net = payload.get("net_income")
                if net is not None:
                    return {
                        "amount": float(net),
                        "currency": payload.get("currency", "EUR"),
                        "source": "payslip",
                    }

        # Priority 2: questionnaire
        existing_profile = get_user_profile(self.db, user_id)
        if existing_profile and existing_profile.questionnaire_answers:
            qa = existing_profile.questionnaire_answers
            monthly_income = qa.get("monthly_net_income") or qa.get("monthlyNetIncome")
            if monthly_income:
                return {
                    "amount": float(monthly_income),
                    "currency": qa.get("currency", "EUR"),
                    "source": "questionnaire",
                }

        # Priority 3: infer from income-type transactions (excluding obvious transfers/savings)
        income_txns = [
            t
            for t in transactions
            if t.type == "income"
            and t.category not in ("transfers", "savings", "interest")
        ]
        if income_txns:
            total_income = sum(float(t.amount) for t in income_txns)
            return {
                "amount": total_income,
                "currency": "EUR",
                "source": "estimated_from_transactions",
            }

        return None

    def _generate_insights(
        self,
        category_totals: dict[str, float],
        income_summary: dict | None,
        transactions: list[Transaction],
    ) -> list[dict]:
        """Generate 1-3 LLM insight cards highlighting non-obvious spending patterns."""
        if not category_totals:
            return []

        # Compute subscription total for context
        subscription_cats = {"subscriptions", "tech_tools", "telecom"}
        subscription_total = sum(
            v for k, v in category_totals.items() if k in subscription_cats
        )

        # Find transactions with "subscription" tag
        sub_txns = [t for t in transactions if "subscription" in (t.tags or [])]
        sub_count = len(set(t.description.split()[0] for t in sub_txns))

        top_categories = sorted(
            category_totals.items(), key=lambda x: x[1], reverse=True
        )[:5]
        total_spending = sum(category_totals.values())
        income_amount = income_summary["amount"] if income_summary else None

        context = {
            "top_categories": top_categories,
            "total_spending": round(total_spending, 2),
            "subscription_total": round(subscription_total, 2),
            "subscription_service_count": sub_count,
            "income": round(income_amount, 2) if income_amount else None,
            "margin": round(income_amount - total_spending, 2)
            if income_amount
            else None,
        }

        prompt = (
            "You are a financial coach for young adults (18-30) in Italy. "
            "Based on the spending data below, generate 1-3 insight cards. "
            "Focus on NON-OBVIOUS patterns (subscription creep, income-to-fixed-cost ratios, "
            "irregular large spends) — NOT just 'your top category is X'.\n\n"
            "IMPORTANT: Use plain language, no jargon. Audience has low financial literacy.\n\n"
            f"Data: {json.dumps(context, ensure_ascii=False)}\n\n"
            "Return a JSON array of objects with exactly these fields:\n"
            '[{"headline": "...", "data_point": "...", "educational_framing": "..."}]\n'
            "- headline: 6-10 words, provocative, specific\n"
            "- data_point: concrete number (e.g. '€127/month across 6 services')\n"
            "- educational_framing: 1-2 sentences, plain language, actionable\n"
            "Return 1-3 cards only. No extra text."
        )

        try:
            raw = self.llm.complete(
                prompt=prompt,
                system="You are a financial education assistant. Respond only with valid JSON.",
                json_mode=True,
                timeout=30.0,
            )
            cards = json.loads(raw)
            if isinstance(cards, list):
                # Validate structure
                valid_cards = []
                for card in cards[:3]:
                    if all(
                        k in card
                        for k in ("headline", "data_point", "educational_framing")
                    ):
                        valid_cards.append(card)
                return valid_cards
        except (LLMError, json.JSONDecodeError, Exception) as exc:
            logger.warning("Insight generation failed: %s", exc)

        return []

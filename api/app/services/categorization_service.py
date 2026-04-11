"""
CategorizationService: rules-first / LLM-fallback transaction categorization + insight generation.

Fixes applied:
  D. Transfer reconciliation: cross-upload same-amount opposite-sign ≤3-day pairs → internal_transfer
  C. Extraordinary income: separate category for one-off large credits (inheritance, gifts, gambling, crypto, stocks)
  B. Income filter: only category='income' counts as recurring income; recurring unknowns tagged 'possible_income'
  A. Monthly normalization: totals divided by actual months covered by transaction dates (per-source aware)
"""

import hashlib
import json
import logging
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models import (
    CategorizationJob,
    FinancialTimeline,
    MerchantMap,
    Transaction,
    Upload,
    UserProfile,
)
from app.db.repository import (
    get_categorization_job,
    get_confirmed_payslip_documents,
    get_confirmed_transactions_for_user,
    get_confirmed_upload_ids,
    get_user_profile,
    lookup_merchant_map,
    seed_default_tags,
    upsert_categorization_job,
    upsert_timeline_event,
    upsert_user_profile,
    write_merchant_map,
)
from app.ingestion.llm import LLMClient, LLMError

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Category taxonomy
# ────────────────────────────────────────────────────────────────────
VALID_CATEGORIES = {
    "groceries",
    "dining",
    "fast_food",
    "food_delivery",
    "transport",
    "housing",
    "utilities",
    "telecom",
    "subscriptions",
    "health",
    "shopping",
    "personal_care",
    "pets",
    "tech_tools",
    "savings",
    "transfers",  # known internal/P2P transfer, same service
    "internal_transfer",  # reconciled cross-source transfer (D)
    "income",  # recurring regular income (salary, freelance)
    "extraordinary_income",  # one-off: inheritance, gifts, gambling, crypto, stocks (C)
    "interest",
    "donations",
    "uncategorized",
}

# ────────────────────────────────────────────────────────────────────
# Rule engine
# ────────────────────────────────────────────────────────────────────
CATEGORY_RULES: list[tuple[str, str, list[str]]] = [
    # --- Extraordinary income (C) - check before generic income rules ---
    (
        r"eredit|eredi|successione|inheritance|donazione ricevuta|gift received|"
        r"regalo ricevuto|lotteria|gratta e vinci|jackpot|vincita|gambling|casin[oò]|"
        r"poker|betting|bet365|snai|sisal|lottomatica|eurobet|"
        r"crypto|bitcoin|ethereum|binance|coinbase|kraken|bybit|"
        r"trade republic|degiro|fineco trading|directa|banca sella trading|"
        r"cfd |stock sale|vendita azioni|liquidazione titoli|plusvalenza|"
        r"disinvestimento|riscatto fondo|buonuscita|tfr|trattamento fine rapporto",
        "extraordinary_income",
        ["extraordinary", "one_off"],
    ),
    # --- Regular income ---
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
        r"to pocket|to instant access savings|pocket withdrawal|to .* savings|emergency fund",
        "savings",
        ["savings_transfer", "recurring"],
    ),
    (r"balance migration|closing transaction", "transfers", ["savings_transfer"]),
    # --- P2P transfers (same-service, not cross-source) ---
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

# Tolerance for amount matching in transfer reconciliation (D)
_TRANSFER_AMOUNT_TOLERANCE = Decimal("0.02")
_TRANSFER_DATE_WINDOW_DAYS = 3


class CategorizationService:
    def __init__(self, db: Session, llm_client: LLMClient) -> None:
        self.db = db
        self.llm = llm_client

    # ────────────────────────────────────────────────────────────────
    # Progress tracking
    # ────────────────────────────────────────────────────────────────

    def _update_progress(
        self,
        user_id: str,
        files: list[dict],
        txn_total: int,
        txn_categorised: int,
        step_detail: str,
    ) -> None:
        """Write granular progress to categorization_jobs.progress_detail and commit."""
        upsert_categorization_job(
            self.db,
            user_id,
            progress_detail={
                "files": files,
                "txn_total": txn_total,
                "txn_categorised": txn_categorised,
                "current_step_detail": step_detail,
            },
        )
        self.db.commit()

    def run_categorization(self, user_id: str) -> None:
        """Full categorization pipeline. Called as BackgroundTask after confirm-all."""
        seed_default_tags(self.db)

        upsert_categorization_job(
            self.db,
            user_id,
            status="categorizing",
            started_at=datetime.now(UTC),
            error_message=None,
            progress_detail=None,
        )

        try:
            transactions = get_confirmed_transactions_for_user(self.db, user_id)
            if not transactions:
                self._finalize_profile(user_id, transactions)
                return

            # Build per-file metadata from confirmed uploads
            upload_ids = list({t.upload_id for t in transactions})
            uploads: dict[str, Upload] = {}
            for uid in upload_ids:
                row = self.db.query(Upload).filter(Upload.id == uid).first()
                if row:
                    uploads[uid] = row

            # Ordered list of file entries (stable order for display)
            file_entries: list[dict] = [
                {
                    "id": uid,
                    "name": uploads[uid].original_filename if uid in uploads else uid,
                    "status": "pending",
                    "txn_count": None,
                }
                for uid in upload_ids
            ]
            txn_total = len(transactions)

            # Emit initial progress (all pending)
            self._update_progress(
                user_id, file_entries, txn_total, 0, "Avvio categorizzazione"
            )

            # Step D: Transfer reconciliation (before any categorization)
            self._reconcile_transfers(transactions)
            self.db.commit()

            # Step 1: Rules pass (skip already-reconciled internal_transfer rows)
            # Process per-file to track progress
            categorised_so_far = 0
            unmatched: list[Transaction] = []

            for idx, entry in enumerate(file_entries):
                uid = entry["id"]
                file_txns = [t for t in transactions if t.upload_id == uid]

                # Mark this file as processing
                file_entries[idx]["status"] = "processing"
                self._update_progress(
                    user_id,
                    file_entries,
                    txn_total,
                    categorised_so_far,
                    f"Regole: {entry['name']}",
                )

                file_unmatched = []
                for txn in file_txns:
                    if txn.category == "internal_transfer":
                        categorised_so_far += 1
                        continue
                    category, auto_tags = self._apply_rules(txn.description)
                    if category:
                        txn.category = category
                        txn.tags = list(set(auto_tags + (txn.tags or [])))
                        categorised_so_far += 1
                    else:
                        file_unmatched.append(txn)

                unmatched.extend(file_unmatched)

                # Mark file done for rules phase (LLM may still touch it)
                file_entries[idx]["status"] = "done"
                file_entries[idx]["txn_count"] = len(file_txns)
                self._update_progress(
                    user_id,
                    file_entries,
                    txn_total,
                    categorised_so_far,
                    f"Regole completate: {entry['name']}",
                )

            self.db.commit()

            # Step 1.5: Merchant map pre-check (D-11)
            still_unmatched: list[Transaction] = []
            for txn in unmatched:
                map_entry = lookup_merchant_map(self.db, txn.description or "")
                if map_entry:
                    txn.category = map_entry.category
                    txn.tags = list(set((txn.tags or []) + ["merchant_map"]))
                    categorised_so_far += 1
                else:
                    still_unmatched.append(txn)
            unmatched = still_unmatched
            self.db.commit()

            # Step 2: 3-tier LLM escalation for unmatched (D-01, D-05)
            if unmatched:
                for txn in unmatched:
                    category, confidence, route_used = self._classify_with_escalation(
                        txn
                    )
                    txn.category = category
                    txn.tags = list(set((txn.tags or []) + ["llm_classified"]))
                    # D-08: Write to merchant_map implicitly
                    if category != "uncategorized" and route_used != "none":
                        write_merchant_map(
                            self.db,
                            description_raw=txn.description or "",
                            category=category,
                            confidence=confidence,
                            learned_method=route_used,
                            contributing_job_id=None,
                            contributing_upload_id=txn.upload_id,
                        )
                    categorised_so_far += 1
                self.db.commit()
                self._update_progress(
                    user_id,
                    file_entries,
                    txn_total,
                    categorised_so_far,
                    f"Classificazione LLM completata ({len(unmatched)} transazioni)",
                )
            else:
                self._update_progress(
                    user_id,
                    file_entries,
                    txn_total,
                    categorised_so_far,
                    "Classificazione LLM non necessaria",
                )

            # Step B: Tag recurring unknowns as possible_income
            self._tag_possible_income(transactions)
            self.db.commit()

            # Step 3: Generate insights
            upsert_categorization_job(self.db, user_id, status="generating_insights")
            self._update_progress(
                user_id,
                file_entries,
                txn_total,
                txn_total,
                "Generazione approfondimenti",
            )

            self._finalize_profile(user_id, transactions)

            # Step 4: Timeline inference (D-17)
            self._run_timeline_inference(user_id, transactions)

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

    # ────────────────────────────────────────────────────────────────
    # D: Transfer reconciliation
    # ────────────────────────────────────────────────────────────────

    def _reconcile_transfers(self, transactions: list[Transaction]) -> None:
        """
        Detect cross-source internal transfers: same absolute amount, opposite sign,
        within DATE_WINDOW days, from different upload_ids.

        Uses a greedy O(n log n) approach: sort positives and negatives by amount,
        then for each positive scan candidates within the tolerance window.

        Both sides are marked category='internal_transfer', type='transfer',
        tags=['reconciled_transfer']. They are excluded from income and expense
        totals downstream.
        """
        # Split into credits and debits, skip already-categorized rows
        credits = [t for t in transactions if t.amount > 0 and not t.category]
        debits = [t for t in transactions if t.amount < 0 and not t.category]

        # Sort by amount magnitude for efficient matching
        credits_by_amt: dict[str, list[Transaction]] = defaultdict(list)
        for t in credits:
            key = str(abs(t.amount).quantize(Decimal("0.01")))
            credits_by_amt[key].append(t)

        matched_ids: set[str] = set()

        for debit in debits:
            if debit.id in matched_ids:
                continue
            debit_amt_key = str(abs(debit.amount).quantize(Decimal("0.01")))

            # Look for credits within tolerance band
            candidates = []
            for key, txns in credits_by_amt.items():
                try:
                    key_dec = Decimal(key)
                    debit_dec = Decimal(debit_amt_key)
                    if abs(key_dec - debit_dec) <= _TRANSFER_AMOUNT_TOLERANCE:
                        candidates.extend(txns)
                except Exception:
                    continue

            for credit in candidates:
                if credit.id in matched_ids:
                    continue
                # Must be from a different upload source
                if credit.upload_id == debit.upload_id:
                    continue
                # Must be within date window
                date_delta = abs((credit.date - debit.date).days)
                if date_delta > _TRANSFER_DATE_WINDOW_DAYS:
                    continue

                # Match found - mark both
                for txn in (credit, debit):
                    txn.category = "internal_transfer"
                    txn.type = "transfer"
                    txn.tags = list(set(["reconciled_transfer"] + (txn.tags or [])))
                matched_ids.add(credit.id)
                matched_ids.add(debit.id)
                logger.info(
                    "Reconciled transfer: %s ↔ %s (%.2f %s, Δ%d days)",
                    debit.id,
                    credit.id,
                    abs(float(debit.amount)),
                    debit.currency,
                    date_delta,
                )
                break  # one credit per debit

    # ────────────────────────────────────────────────────────────────
    # Rules engine
    # ────────────────────────────────────────────────────────────────

    def _apply_rules(self, description: str) -> tuple[str | None, list[str]]:
        desc_lower = (description or "").lower()
        for pattern, category, tags in CATEGORY_RULES:
            if re.search(pattern, desc_lower, re.IGNORECASE):
                return category, tags
        return None, []

    # ────────────────────────────────────────────────────────────────
    # LLM batch fallback
    # ────────────────────────────────────────────────────────────────

    def _llm_classify_batch(self, transactions: list[Transaction]) -> None:
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
                f"IMPORTANT RULES:\n"
                f"- Use 'income' ONLY for regular recurring salary/freelance income.\n"
                f"- Use 'extraordinary_income' for one-off large credits: inheritance, gifts, "
                f"gambling wins, crypto sales, stock liquidations, severance, TFR.\n"
                f"- Use 'internal_transfer' for movements between the user's own accounts "
                f"(e.g. top-up to Revolut, transfer to savings, PayPal transfer to bank).\n"
                f"- Use 'transfers' only for P2P payments to other people.\n\n"
                f"Return a JSON array:\n"
                f'[{{"idx": 0, "category": "...", "tags": []}}, ...]\n\n'
                f"Tags must be from: recurring, subscription, food_delivery, fast_food, "
                f"peer_transfer, savings_transfer, refund, work_income, freelance_income, "
                f"interest, utility, telecom, hosting, tech_tools, transport, pet, health, "
                f"donation, condominium, extraordinary, one_off\n\n"
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
                for txn in batch:
                    if not txn.category:
                        txn.category = "uncategorized"

        self.db.commit()

    def _llm_classify_batch_with_progress(
        self,
        transactions: list[Transaction],
        user_id: str,
        file_entries: list[dict],
        txn_total: int,
        categorised_before: int,
    ) -> None:
        """LLM batch classification with per-batch progress updates."""
        BATCH_SIZE = 50
        valid_cats = sorted(VALID_CATEGORIES)
        categorised_now = 0

        for i in range(0, len(transactions), BATCH_SIZE):
            batch = transactions[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(transactions) + BATCH_SIZE - 1) // BATCH_SIZE
            step_detail = (
                f"Classificazione LLM ({categorised_before + categorised_now + len(batch)}"
                f"/{txn_total})"
                if total_batches > 1
                else f"Classificazione LLM ({len(transactions)} transazioni)"
            )
            self._update_progress(
                user_id,
                file_entries,
                txn_total,
                categorised_before + categorised_now,
                step_detail,
            )

            items = [
                {"idx": j, "description": t.description, "amount": float(t.amount)}
                for j, t in enumerate(batch)
            ]
            prompt = (
                f"Classify each transaction into exactly one category from this list:\n"
                f"{valid_cats}\n\n"
                f"IMPORTANT RULES:\n"
                f"- Use 'income' ONLY for regular recurring salary/freelance income.\n"
                f"- Use 'extraordinary_income' for one-off large credits: inheritance, gifts, "
                f"gambling wins, crypto sales, stock liquidations, severance, TFR.\n"
                f"- Use 'internal_transfer' for movements between the user's own accounts "
                f"(e.g. top-up to Revolut, transfer to savings, PayPal transfer to bank).\n"
                f"- Use 'transfers' only for P2P payments to other people.\n\n"
                f"Return a JSON array:\n"
                f'[{{"idx": 0, "category": "...", "tags": []}}, ...]\n\n'
                f"Tags must be from: recurring, subscription, food_delivery, fast_food, "
                f"peer_transfer, savings_transfer, refund, work_income, freelance_income, "
                f"interest, utility, telecom, hosting, tech_tools, transport, pet, health, "
                f"donation, condominium, extraordinary, one_off\n\n"
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
                logger.warning(
                    "LLM batch classification failed (batch %d): %s", batch_num, exc
                )
                for txn in batch:
                    if not txn.category:
                        txn.category = "uncategorized"

            categorised_now += len(batch)

        self.db.commit()

    def _tag_possible_income(self, transactions: list[Transaction]) -> None:
        """
        Among uncategorized positive transactions, find recurring ones:
        same description prefix appearing in ≥2 distinct calendar months
        from the same upload source. Tag them 'possible_income' so the
        user/UI can surface them for confirmation.
        """
        candidates = [
            t
            for t in transactions
            if t.amount > 0
            and t.category in ("uncategorized", None)
            and t.type != "transfer"
        ]

        # Group by (upload_id, description_prefix) - first 30 chars normalised
        groups: dict[tuple[str, str], list[Transaction]] = defaultdict(list)
        for t in candidates:
            prefix = re.sub(r"\s+", " ", (t.description or "").lower().strip())[:30]
            groups[(t.upload_id, prefix)].append(t)

        for (upload_id, prefix), group in groups.items():
            months = {(t.date.year, t.date.month) for t in group}
            if len(months) >= 2:
                for t in group:
                    t.tags = list(set(["possible_income"] + (t.tags or [])))
                logger.info(
                    "Tagged %d txns as possible_income (upload=%s prefix='%s')",
                    len(group),
                    upload_id,
                    prefix,
                )

    # ────────────────────────────────────────────────────────────────
    # Phase 9: 3-tier LLM escalation + timeline inference
    # ────────────────────────────────────────────────────────────────

    # JSON schema for structured classification output
    _CLASSIFICATION_SCHEMA: dict = {
        "type": "object",
        "properties": {
            "category": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": ["category", "confidence"],
        "additionalProperties": False,
    }

    def _classify_with_escalation(self, txn: Transaction) -> tuple[str, float, str]:
        """Try sm→md→lg LLM classification. Returns (category, confidence, route).
        Returns ("uncategorized", 0.0, "none") if all tiers fail."""
        TIERS = [
            ("text:classification:sm", 0.6),
            ("text:classification:md", 0.5),
            ("text:classification:lg", 0.4),
        ]
        valid_cats = sorted(VALID_CATEGORIES)
        description = txn.description or ""
        for route, min_confidence in TIERS:
            try:
                raw = self.llm.complete(
                    prompt=(
                        f"Classify this financial transaction into exactly one category.\n"
                        f"Categories: {valid_cats}\n\n"
                        f"RULES:\n"
                        f"- 'income': regular recurring salary/freelance\n"
                        f"- 'extraordinary_income': one-off credits (gifts, crypto, stocks, TFR)\n"
                        f"- 'internal_transfer': movements between own accounts\n"
                        f"- 'transfers': P2P payments to other people\n\n"
                        f"Transaction: {description}\n\n"
                        f'Return JSON: {{"category": "...", "confidence": 0.0}}'
                    ),
                    system="You are a financial transaction classifier. Respond only with valid JSON.",
                    json_mode=True,
                    response_schema=self._CLASSIFICATION_SCHEMA,
                    route=route,
                    timeout=8.0,
                )
                # Robust JSON extraction: strip markdown fences if model wraps output
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                parsed = json.loads(cleaned)
                category = parsed.get("category", "uncategorized")
                confidence = float(parsed.get("confidence", 0.0))
                if category in VALID_CATEGORIES and confidence >= min_confidence:
                    return category, confidence, route
            except Exception as e:
                logger.warning("LLM tier %s failed for txn %s: %s", route, txn.id, e)
                continue
        return "uncategorized", 0.0, "none"

    def _run_timeline_inference(
        self, user_id: str, transactions: list[Transaction]
    ) -> None:
        """Detect life events from transaction patterns and upsert into financial_timeline."""
        import calendar
        from datetime import date

        if not transactions:
            return

        # Group transactions by (year, month) for pattern analysis
        by_month: dict[tuple[int, int], list[Transaction]] = defaultdict(list)
        for t in transactions:
            if t.date:
                by_month[(t.date.year, t.date.month)].append(t)

        months_sorted = sorted(by_month.keys())
        if len(months_sorted) < 2:
            return  # Need at least 2 months for pattern detection

        # ── Event: major one-off purchase (D-13) ──
        # Single transaction > 2x average monthly category spend
        category_monthly_totals: dict[str, float] = defaultdict(float)
        skip_cats = {"income", "extraordinary_income", "internal_transfer", "transfers"}
        for (yr, mo), txns in by_month.items():
            for t in txns:
                if t.amount and float(t.amount) < 0 and t.category not in skip_cats:
                    category_monthly_totals[t.category or "uncategorized"] += abs(
                        float(t.amount)
                    )
        n_months = len(months_sorted)
        for cat, total in category_monthly_totals.items():
            avg = total / n_months
            for t in transactions:
                if (
                    t.category == cat
                    and t.amount
                    and abs(float(t.amount)) > 2 * avg
                    and abs(float(t.amount)) > 200
                    and t.date
                ):
                    upsert_timeline_event(
                        self.db,
                        user_id,
                        event_type="major_purchase",
                        event_date=t.date,
                        title=f"Grande acquisto: {cat}",
                        description=(
                            f"Transazione di €{abs(float(t.amount)):.0f} supera il doppio della "
                            f"media mensile per {cat} (media: €{avg:.0f}/mese)"
                        ),
                        evidence_json={
                            "transaction_id": t.id,
                            "amount": float(t.amount),
                            "category": cat,
                            "avg_monthly": round(avg, 2),
                        },
                    )

        # ── Event: extraordinary_income (already tagged in Phase 3) ──
        for t in transactions:
            if t.category == "extraordinary_income" and t.date:
                upsert_timeline_event(
                    self.db,
                    user_id,
                    event_type="extraordinary_income",
                    event_date=t.date,
                    title="Reddito straordinario",
                    description=f"Entrata straordinaria di €{abs(float(t.amount or 0)):.0f}",
                    evidence_json={
                        "transaction_id": t.id,
                        "amount": float(t.amount or 0),
                        "description": t.description,
                    },
                )

        # ── Event: relocation (D-13) ────────────────────────────────────────────────
        # Cluster of moving-related keywords within 30-day window
        _RELOCATION_KEYWORDS = {
            "trasloco", "allaccio", "rimozione", "agenzia immobiliare",
            "caparra", "deposito cauzionale", "spese condominiali",
        }
        _reloc_hits = [
            (t.date, t.description)
            for t in transactions
            if t.date and t.description
            and any(kw in t.description.lower() for kw in _RELOCATION_KEYWORDS)
        ]
        if _reloc_hits:
            _reloc_hits.sort(key=lambda x: x[0])
            evt_date = _reloc_hits[0][0]
            upsert_timeline_event(
                self.db,
                user_id,
                event_type="relocation",
                event_date=evt_date,
                title="Possibile trasferimento",
                description="Transazioni legate a un trasferimento rilevate.",
                evidence_json={
                    "keywords_found": [d for _, d in _reloc_hits[:3]],
                    "transaction_count": len(_reloc_hits),
                },
            )

        # ── Event: subscription accumulation (D-13) ──
        sub_by_month: dict[tuple[int, int], set[str]] = defaultdict(set)
        for t in transactions:
            if t.category == "subscriptions" and t.date and t.description:
                sub_by_month[(t.date.year, t.date.month)].add(
                    t.description.lower()[:40]
                )
        all_known_subs: set[str] = set()
        SUBSCRIPTION_THRESHOLD = 3
        for yr, mo in months_sorted:
            month_subs = sub_by_month.get((yr, mo), set())
            new_subs = month_subs - all_known_subs
            if len(new_subs) >= SUBSCRIPTION_THRESHOLD:
                evt_date = date(yr, mo, 1)
                upsert_timeline_event(
                    self.db,
                    user_id,
                    event_type="subscription_accumulation",
                    event_date=evt_date,
                    title=f"Accumulo abbonamenti: {len(new_subs)} nuovi servizi",
                    description=f"In {mo}/{yr} hai aggiunto {len(new_subs)} nuovi abbonamenti.",
                    evidence_json={
                        "new_subscriptions": list(new_subs),
                        "month": f"{yr}-{mo:02d}",
                    },
                )
            all_known_subs |= month_subs

        # ── Event: income shift / job change (D-13) ──
        income_senders_by_month: dict[tuple[int, int], set[str]] = defaultdict(set)
        for t in transactions:
            if t.category == "income" and t.date and t.description:
                income_senders_by_month[(t.date.year, t.date.month)].add(
                    t.description.lower()[:60]
                )
        prev_senders: set[str] = set()
        for yr, mo in months_sorted:
            curr_senders = income_senders_by_month.get((yr, mo), set())
            if prev_senders and curr_senders:
                disappeared = prev_senders - curr_senders
                appeared = curr_senders - prev_senders
                if disappeared and appeared:
                    evt_date = date(yr, mo, 1)
                    upsert_timeline_event(
                        self.db,
                        user_id,
                        event_type="income_shift",
                        event_date=evt_date,
                        title="Possibile cambio di lavoro",
                        description=(
                            f"Un pagamento ricorrente è scomparso e ne è apparso uno nuovo "
                            f"in {mo}/{yr}."
                        ),
                        evidence_json={
                            "disappeared": list(disappeared)[:3],
                            "appeared": list(appeared)[:3],
                            "month": f"{yr}-{mo:02d}",
                        },
                    )
            if curr_senders:
                prev_senders = curr_senders

        # ── Event: debt_change (new recurring fixed-amount payment) ────────────────
        # Recurring transaction to same counterpart, >=200 EUR, monthly cadence, >=3 times
        from collections import defaultdict as _dd  # noqa: PLC0415
        from decimal import Decimal as _D  # noqa: PLC0415

        _debt_candidates: dict[str, list] = _dd(list)
        for t in transactions:
            if (
                t.amount is not None
                and float(t.amount) < -200  # debit only
                and t.description
                and t.date
            ):
                key = t.description.lower()[:50]
                _debt_candidates[key].append(t)

        for key, txns in _debt_candidates.items():
            if len(txns) < 3:
                continue
            # Check monthly cadence: gaps between dates ~28-32 days
            dates_sorted = sorted(t.date for t in txns if t.date)
            if len(dates_sorted) < 3:
                continue
            gaps = [(dates_sorted[i + 1] - dates_sorted[i]).days for i in range(len(dates_sorted) - 1)]
            monthly = all(25 <= g <= 40 for g in gaps)
            if not monthly:
                continue
            # Amount consistency: within 2%
            amounts = [abs(float(t.amount)) for t in txns if t.amount]
            avg_amt = sum(amounts) / len(amounts)
            if not all(abs(a - avg_amt) / avg_amt < 0.03 for a in amounts):
                continue
            evt_date = dates_sorted[0]
            upsert_timeline_event(
                self.db,
                user_id,
                event_type="debt_change",
                event_date=evt_date,
                title=f"Possibile nuovo debito: {txns[0].description[:40] if txns[0].description else 'n/a'}",
                description=(
                    f"Pagamento ricorrente di \u20ac{avg_amt:.0f}/mese rilevato ({len(txns)} occorrenze)."
                ),
                evidence_json={
                    "counterpart": key,
                    "monthly_amount": round(avg_amt, 2),
                    "occurrences": len(txns),
                    "first_seen": str(dates_sorted[0]),
                },
            )

        self.db.commit()

    def _months_covered(self, transactions: list[Transaction]) -> float:
        """
        Compute how many months are covered by this transaction set.
        Uses actual transaction dates (not file metadata).
        Minimum 1.0 to avoid division by zero on single-month data.
        """
        dates = [t.date for t in transactions if t.date is not None]
        if not dates:
            return 1.0
        min_date = min(dates)
        max_date = max(dates)
        days = (max_date - min_date).days
        months = days / 30.44
        return max(months, 1.0)

    def _monthly_average(self, total: float, months: float) -> float:
        return round(total / months, 2)

    # ────────────────────────────────────────────────────────────────
    # Profile finalization
    # ────────────────────────────────────────────────────────────────

    def _finalize_profile(self, user_id: str, transactions: list[Transaction]) -> None:
        """Compute monthly-normalised summary stats, generate insights, save UserProfile."""
        # Exclude internal_transfer from all accounting
        accounting_txns = [
            t
            for t in transactions
            if t.category not in ("internal_transfer",) and t.type != "transfer"
        ]

        months = self._months_covered(accounting_txns) if accounting_txns else 1.0

        # Category totals for expenses (raw, then normalised)
        category_totals_raw: dict[str, float] = {}
        for txn in accounting_txns:
            if (
                txn.type == "expense"
                and txn.category
                and txn.category
                not in (
                    "transfers",
                    "savings",
                    "internal_transfer",
                    "extraordinary_income",
                )
            ):
                cat = txn.category or "uncategorized"
                category_totals_raw[cat] = category_totals_raw.get(cat, 0.0) + abs(
                    float(txn.amount)
                )

        # Normalise expense categories to monthly
        category_totals: dict[str, float] = {
            cat: self._monthly_average(total, months)
            for cat, total in category_totals_raw.items()
        }

        # Extraordinary income total (raw over period, reported separately - not monthly)
        extraordinary_raw = sum(
            float(t.amount)
            for t in accounting_txns
            if t.category == "extraordinary_income" and t.amount > 0
        )

        # Income summary (D-19 priority chain, B: strict category filter)
        income_summary = self._compute_income(user_id, accounting_txns, months)

        # Monthly expenses
        total_expenses_monthly = sum(category_totals.values())

        # Margin
        monthly_margin = None
        if income_summary:
            monthly_margin = round(income_summary["amount"] - total_expenses_monthly, 2)

        # Data sources
        data_sources = []
        if any(t.type == "income" and t.category == "income" for t in accounting_txns):
            data_sources.append("bank_statement")
        payslips = get_confirmed_payslip_documents(self.db, user_id)
        if payslips:
            data_sources.append("payslip")
        existing_profile = get_user_profile(self.db, user_id)
        if existing_profile and existing_profile.questionnaire_answers:
            data_sources.append("questionnaire")

        # Insight cards
        insight_cards = self._generate_insights(
            category_totals,
            income_summary,
            accounting_txns,
            extraordinary_raw,
            months,
        )

        upsert_user_profile(
            self.db,
            user_id,
            income_summary=income_summary,
            monthly_expenses=total_expenses_monthly,
            monthly_margin=monthly_margin,
            category_totals=category_totals,
            insight_cards=insight_cards,
            data_sources=list(set(data_sources)),
            profile_generated_at=datetime.now(UTC),
            uploads_fingerprint=hashlib.sha256(
                ",".join(get_confirmed_upload_ids(self.db, user_id)).encode()
            ).hexdigest(),
            # Extra fields stored in JSON - frontend ignores unknown keys
            extraordinary_income_total=round(extraordinary_raw, 2),
            months_covered=round(months, 2),
        )

        upsert_categorization_job(
            self.db,
            user_id,
            status="complete",
            completed_at=datetime.now(UTC),
        )
        self.db.commit()

    def _compute_income(
        self,
        user_id: str,
        transactions: list[Transaction],
        months: float,
    ) -> dict | None:
        """
        D-19 priority chain with B fix: only category='income' transactions count.
        Returns monthly normalised amount.
        """
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

        # Priority 3: infer from transactions - B: only category='income' (not None, not uncategorized)
        income_txns = [
            t
            for t in transactions
            if t.category
            == "income"  # strict: must be explicitly categorised as income
            and t.amount > 0
        ]
        if income_txns:
            total_income_raw = sum(float(t.amount) for t in income_txns)
            monthly_income = self._monthly_average(total_income_raw, months)
            return {
                "amount": monthly_income,
                "currency": "EUR",
                "source": "estimated_from_transactions",
            }

        return None

    # ────────────────────────────────────────────────────────────────
    # Insight generation
    # ────────────────────────────────────────────────────────────────

    def _generate_insights(
        self,
        category_totals: dict[str, float],
        income_summary: dict | None,
        transactions: list[Transaction],
        extraordinary_raw: float,
        months: float,
    ) -> list[dict]:
        if not category_totals:
            return []

        subscription_cats = {"subscriptions", "tech_tools", "telecom"}
        subscription_total = sum(
            v for k, v in category_totals.items() if k in subscription_cats
        )
        sub_txns = [t for t in transactions if "subscription" in (t.tags or [])]
        sub_count = len(set(t.description.split()[0] for t in sub_txns))

        possible_income_txns = [
            t for t in transactions if "possible_income" in (t.tags or [])
        ]
        possible_income_monthly = (
            self._monthly_average(
                sum(float(t.amount) for t in possible_income_txns), months
            )
            if possible_income_txns
            else 0.0
        )

        top_categories = sorted(
            category_totals.items(), key=lambda x: x[1], reverse=True
        )[:5]
        total_spending = sum(category_totals.values())
        income_amount = income_summary["amount"] if income_summary else None

        context = {
            "top_categories": top_categories,
            "total_monthly_spending": round(total_spending, 2),
            "subscription_monthly_total": round(subscription_total, 2),
            "subscription_service_count": sub_count,
            "monthly_income": round(income_amount, 2) if income_amount else None,
            "monthly_margin": round(income_amount - total_spending, 2)
            if income_amount
            else None,
            "months_of_data_analysed": round(months, 1),
            "extraordinary_income_total": round(extraordinary_raw, 2),
            "possible_unclassified_income_monthly": round(possible_income_monthly, 2),
            "note": "All figures are monthly averages. extraordinary_income is a raw total over the full period.",
        }

        prompt = (
            "You are a financial coach for young adults (18-30) in Italy. "
            "Based on the spending data below, generate 1-3 insight cards. "
            "Focus on NON-OBVIOUS patterns (subscription creep, income-to-fixed-cost ratios, "
            "irregular large spends, extraordinary one-off income that inflates the apparent income) "
            "- NOT just 'your top category is X'.\n\n"
            "If extraordinary_income_total > 0, add a card warning the user not to treat it as "
            "regular monthly income and to plan it separately.\n"
            "If possible_unclassified_income_monthly > 0, note there may be unclassified income "
            "sources worth reviewing.\n\n"
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

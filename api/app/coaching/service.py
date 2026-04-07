"""
CoachingService: assembles prompts, calls LLM, validates output, scans for safety.

Architecture:
  1. Load persona soul + system prompt components from file system
  2. Fetch user profile from DB
  3. Render Jinja2 templates
  4. Call LLMClient with json_mode=True
  5. Validate output against coaching_response.schema.json
  6. Scan output with SafetyScanner
  7. Return validated coaching response dict

Stateful session persistence is handled at the API layer (Plan 04-02).
"""

import json
import hashlib
import logging
from pathlib import Path
from typing import Any, Optional

import jsonschema
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session

from app.coaching.safety import SafetyScanner
from app.content.search import search_content, search_regional_knowledge, get_always_injected_knowledge
from app.db.models import WelcomeCache
from app.ingestion.llm import LLMClient, LLMError
from app.services.profile_service import ProfileError, ProfileService

logger = logging.getLogger(__name__)

# ── Tool schema for BM25 content search ───────────────────────────────────────

_SEARCH_CONTENT_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "search_content",
        "description": (
            "Search the educational content and partner offer catalog. "
            "Returns a ranked list of articles, videos, slide decks, and partner offers "
            "matching the query in the specified locale. "
            "Always call this before populating resource_cards or recommending partner offers."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keywords describing what the user needs.",
                },
                "locale": {
                    "type": "string",
                    "enum": ["it", "en"],
                    "description": "Locale to search in - must match the response locale.",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Maximum results to return (default 5).",
                    "default": 5,
                },
                "content_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["article", "video", "slide_deck", "partner_offer"],
                    },
                    "description": "Optional filter to specific content types.",
                },
            },
            "required": ["query", "locale"],
            "additionalProperties": False,
        },
    },
}

_SEARCH_REGIONAL_KNOWLEDGE_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "search_regional_knowledge",
        "description": (
            "Search country/region-specific financial rules, tax brackets, bonuses, and regulations. "
            "Use when the user asks about taxes, contributions, government benefits, or local financial rules. "
            "Defaults to the user's registered nations. Pass 'nation' explicitly when the user asks about a specific country."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keywords describing the rule or topic (e.g. 'IRPEF scaglioni', 'income tax brackets', 'bonus affitto').",
                },
                "nation": {
                    "type": "string",
                    "description": (
                        "ISO 3166-1 alpha-2 country code to search (e.g. 'IT', 'DE', 'FR', 'US'). "
                        "Optional - omit to search the user's registered nations. "
                        "Provide when the user explicitly asks about a different country."
                    ),
                },
                "top_k": {
                    "type": "integer",
                    "description": "Maximum results to return (default 3).",
                    "default": 3,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
}

# Module-level soul-hash cache: avoids re-reading the soul file on every request.
# Invalidated only when the process restarts (file changes require a redeploy anyway).
_soul_hash_cache: dict[str, str] = {}

# Phase 19: get_timeline_events tool
_GET_TIMELINE_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "get_timeline_events",
        "description": (
            "Fetch the user's financial life events (income changes, relocations, "
            "debt changes, major purchases, subscriptions). Use when the user asks "
            "about their financial history or life events."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "income_shift",
                            "major_purchase",
                            "subscription_accumulation",
                            "extraordinary_income",
                            "relocation",
                            "debt_change",
                        ],
                    },
                    "description": "Event types to fetch. Empty array = all types.",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

# Phase 20: user profile + transaction search + preferences + insights recall tools
_GET_USER_PROFILE_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "get_user_profile",
        "description": (
            "Get the user's current financial profile: income range, monthly expense estimate, "
            "savings rate, top spending categories, and verified income sources. "
            "Call at the start of any financial conversation."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
    },
}

_SEARCH_USER_TRANSACTIONS_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "search_user_transactions",
        "description": (
            "Search the user's personal transaction history by keyword. "
            "Returns matching transactions with date, amount, category, and description."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keywords to search in transaction descriptions.",
                },
                "category": {
                    "type": "string",
                    "description": "Optional: filter by spending category.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 10).",
                    "default": 10,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
}

_GET_USER_PREFERENCES_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "get_user_preferences",
        "description": (
            "Get the user's stated financial goals, spending preferences (dos), "
            "and spending rules (don'ts). Use to align recommendations with their values."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
    },
}

_RECALL_INSIGHTS_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "recall_past_insights",
        "description": (
            "Recall previously captured insights about this user's financial behaviour, "
            "goals, or context from past coaching conversations."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "Keyword to search (e.g. 'risparmio', 'affitto', 'spese fisse').",
                },
            },
            "required": ["topic"],
            "additionalProperties": False,
        },
    },
}

COACHING_DIR = Path(__file__).parent
PERSONAS_DIR = COACHING_DIR.parent / "personas"
SCHEMAS_DIR = COACHING_DIR / "schemas"
PROMPTS_DIR = COACHING_DIR / "prompts"

_SUPPORTED_LOCALES = {"it", "en"}
_DEFAULT_LOCALE = "it"
_DEFAULT_PERSONA_ID = "mentore-saggio"
# Phase 7: allow all configured personas while defaulting safely when unknown
_ALLOWED_PERSONAS = {
    "mentore-saggio",
    "amico-sarcastico",
    "hartman",
    "cheerleader",
}

_BLOCKED_RESPONSE_TEMPLATE = {
    "message": "Non riesco a rispondere a questa richiesta.",
    "reasoning_used": [],
    "action_cards": [],
    "resource_cards": [],
    "learn_cards": [],
    "details_a2ui": None,
    "_blocked": True,
}


class CoachingError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class CoachingService:
    def __init__(self, db: Session, llm_client: LLMClient) -> None:
        self.db = db
        self.llm = llm_client
        self._scanner = SafetyScanner()
        self._jinja_env = Environment(
            loader=FileSystemLoader(str(PROMPTS_DIR)),
            autoescape=False,
        )
        # Load static assets once at init
        self._ethos = (PERSONAS_DIR / "ethos.md").read_text(encoding="utf-8")
        self._boundaries = (PERSONAS_DIR / "boundaries.md").read_text(encoding="utf-8")
        self._allowlist = (PERSONAS_DIR / "allowlist.md").read_text(encoding="utf-8")
        with open(SCHEMAS_DIR / "coaching_response.schema.json", encoding="utf-8") as f:
            self._response_schema = json.load(f)
        with open(SCHEMAS_DIR / "capabilities.schema.json", encoding="utf-8") as f:
            self._capabilities = json.load(f)
        with open(PERSONAS_DIR / "config.json", encoding="utf-8") as f:
            self._persona_config = json.load(f)
        self._a2ui_reference = self._jinja_env.get_template(
            "a2ui_reference.j2"
        ).render()
        # Welcome cache is module-level (_welcome_cache) - survives across request instances.

    def generate_conversation_name(self, first_user_message: str) -> str:
        """
        Generate a short (3-6 word) conversation title from the first user message.
        Uses a fast LLM call. Falls back to a truncated message on failure.
        """
        prompt = (
            "Dai un titolo breve (massimo 5 parole) a questa conversazione. "
            "Rispondi SOLO con il titolo, senza punteggiatura finale, senza virgolette.\n\n"
            f"Primo messaggio: {first_user_message[:300]}"
        )
        try:
            raw = self.llm.complete(
                prompt=prompt,
                system="Sei un assistente che genera titoli brevi per conversazioni finanziarie.",
                json_mode=False,
                timeout=10.0,
            )
            name = raw.strip().strip('"').strip("'")
            return name[:120] if name else first_user_message[:60]
        except LLMError:
            return first_user_message[:60]

    def _soul_hash(self, persona_id: str) -> str:
        """Return a SHA3-256 hex digest of the soul file for `persona_id`.

        Cached in-process after first read; changes require a container restart,
        which is the correct invalidation boundary (soul edits → redeploy).
        """
        if persona_id not in _soul_hash_cache:
            soul_text = self._load_soul(persona_id)
            _soul_hash_cache[persona_id] = hashlib.sha3_256(
                soul_text.encode()
            ).hexdigest()
        return _soul_hash_cache[persona_id]

    def _welcome_cache_key(
        self,
        first_name: str | None,
        voice_gender: str,
        persona_id: str,
        locale: str,
    ) -> str:
        """Stable, content-addressed cache key for a welcome message.

        Inputs that affect the generated text:
          - first_name  : personalisation
          - voice_gender: grammatical gender of the coach addressing the user
          - persona_id  : determines the soul file and system prompt
          - locale      : language of the output
          - soul_hash   : invalidates the entry when the soul file is edited
        """
        soul_hash = self._soul_hash(persona_id)
        raw = f"{first_name or ''}:{voice_gender}:{persona_id}:{locale}:{soul_hash}"
        return "SHA3:" + hashlib.sha3_256(raw.encode()).hexdigest()

    def get_welcome(
        self,
        user_id: str,
        first_name: str | None = None,
        voice_gender: str = "indifferent",
        locale: str = _DEFAULT_LOCALE,
        persona_id: str = _DEFAULT_PERSONA_ID,
    ) -> str:
        """Generate (or return cached) a short personalised welcome message.

        Cache strategy: Postgres `welcome_cache` table, keyed on a SHA3-256
        digest of (first_name, voice_gender, persona_id, locale, soul_hash).
        The key is content-addressed - it changes only when personalisation
        inputs or the soul file change, not on every container restart.

        `user_id` is intentionally NOT part of the key: two users with the
        same name/gender/persona/locale get the same cached text, which is
        fine (the message is generic personalisation, not user-specific data).
        """
        locale = locale if locale in _SUPPORTED_LOCALES else _DEFAULT_LOCALE

        cache_key = self._welcome_cache_key(
            first_name, voice_gender, persona_id, locale
        )

        # ── Postgres cache read ───────────────────────────────────────────────
        cached = (
            self.db.query(WelcomeCache)
            .filter(WelcomeCache.cache_key == cache_key)
            .first()
        )
        if cached:
            return cached.text

        # ── Build prompt ──────────────────────────────────────────────────────
        name_part = f" {first_name}" if first_name else ""
        if locale == "en":
            prompt = (
                f"You are a warm and friendly financial education coach. "
                f"Write a short (2-3 sentences), encouraging welcome message for a user named{name_part or ' a user'} "
                f"who has just opened the chat. "
                f"Do not ask questions. Be warm, concise, and motivating. "
                f"Do not include any JSON - plain text only."
            )
        else:
            prompt = (
                f"Sei un coach educativo finanziario amichevole e motivante. "
                f"Scrivi un breve messaggio di benvenuto (2-3 frasi) per{name_part or ' un utente'} "
                f"che ha appena aperto la chat. "
                f"Non fare domande. Sii caloroso, conciso e incoraggiante. "
                f"Solo testo - nessun JSON."
            )

        soul_text = self._load_soul(persona_id)
        system_prompt = self._render_system(soul_text, locale)

        try:
            raw = self.llm.complete(
                prompt=prompt,
                system=system_prompt,
                json_mode=False,
                timeout=20.0,
            )
            result = raw.strip()
        except LLMError:
            if locale == "en":
                result = f"Hi{name_part}! I'm your financial coach. Ask me anything about your budget, spending, or financial goals."
            else:
                result = f"Ciao{name_part}! Sono il tuo Mentore Saggio. Chiedimi qualcosa sul tuo budget, le tue spese o i tuoi obiettivi finanziari."

        # ── Postgres cache write ──────────────────────────────────────────────
        try:
            entry = WelcomeCache(cache_key=cache_key, text=result)
            self.db.add(entry)
            self.db.commit()
        except Exception:
            self.db.rollback()
            # Non-fatal: we still return the result; next request will regenerate.
            logger.warning("welcome_cache write failed for key %s", cache_key)

        return result

    def chat(
        self,
        user_id: str,
        messages: list[dict],
        locale: str = _DEFAULT_LOCALE,
        persona_id: str = _DEFAULT_PERSONA_ID,
        debug: bool = False,
    ) -> dict:
        """
        Core coaching interaction.

        Args:
            user_id: The user's ID (used to fetch their financial profile).
            messages: Conversation history as list of {role, content} dicts.
                      The last message should be the new user message.
            locale: Response language - 'it' (default) or 'en'.
            persona_id: Persona to use - Phase 4 only accepts 'mentore-saggio'.
            debug: When True, attach debug payload to returned dict.

        Returns:
            A validated CoachingResponse dict, optionally with '_debug' key.

        Raises:
            CoachingError: On LLM failure, schema validation failure, or missing profile.
            ProfileError: If the user has no confirmed profile.
        """
        # Normalize inputs
        locale = locale if locale in _SUPPORTED_LOCALES else _DEFAULT_LOCALE
        persona_id = (
            persona_id if persona_id in _ALLOWED_PERSONAS else _DEFAULT_PERSONA_ID
        )

        # Load persona soul
        soul_text = self._load_soul(persona_id)

        # Fetch user profile (raises ProfileError → caller converts to HTTP 422)
        profile_service = ProfileService(self.db)
        profile_dto = profile_service.get_profile(user_id)

        # Load user nationalities for regional knowledge injection
        from app.db.repository import get_user_by_id  # noqa: PLC0415
        _user_row = get_user_by_id(self.db, user_id)
        _nationalities: list[str] = (
            (_user_row.nationalities if _user_row and _user_row.nationalities else None)
            or ["IT"]
        )

        # Build always_injected regional context block
        _always_injected = get_always_injected_knowledge(_nationalities)
        _regional_context = ""
        if _always_injected:
            nuggets = "\n".join(
                f"- [{r['title']}] {r['context_nugget']}" for r in _always_injected
            )
            _regional_context = f"\n\n### Regional Financial Rules ({', '.join(_nationalities)})\n{nuggets}"

        # Render templates
        system_prompt = self._render_system(soul_text, locale)
        context_block = self._render_context(profile_dto, user_id=user_id) + _regional_context
        response_format = self._render_response_format()

        # Build conversation prompt
        prompt = self._build_prompt(messages, context_block, response_format)

        # Call LLM with tool-calling support for content + regional knowledge search
        raw: str = ""
        try:
            raw = self.llm.complete_with_tools(
                prompt=prompt,
                system=system_prompt,
                tools=[
                    _SEARCH_CONTENT_TOOL,
                    _SEARCH_REGIONAL_KNOWLEDGE_TOOL,
                    _GET_TIMELINE_TOOL,
                    _GET_USER_PROFILE_TOOL,
                    _SEARCH_USER_TRANSACTIONS_TOOL,
                    _GET_USER_PREFERENCES_TOOL,
                    _RECALL_INSIGHTS_TOOL,
                ],
                tool_executor=self._tool_executor(locale, _nationalities, user_id=user_id),
                response_schema=self._response_schema,
                timeout=60.0,
            )
        except LLMError as exc:
            logger.error("CoachingService LLM error for user %s: %s", user_id, exc)
            raise CoachingError(
                "llm_error", f"LLM unavailable: {exc}", status_code=502
            ) from exc

        # Parse JSON
        schema_valid = True
        try:
            response_data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error(
                "CoachingService JSON parse error: %s | raw=%r", exc, raw[:200]
            )
            raise CoachingError(
                "invalid_response", "LLM returned malformed JSON", status_code=502
            ) from exc

        # Validate against schema
        try:
            jsonschema.validate(instance=response_data, schema=self._response_schema)
        except jsonschema.ValidationError as exc:
            logger.warning("CoachingService schema validation failed: %s", exc.message)
            schema_valid = False

        # Always repair: ensure required array fields exist (idempotent)
        response_data = self._repair_response(response_data)
        # Safety-net: inject fallback cards if LLM skipped tool call on financial questions
        self._inject_fallback_cards(response_data, locale)

        # Persist new_insight to user_profiles.coaching_insights if present
        new_insight = response_data.get("new_insight")
        if new_insight and isinstance(new_insight, dict):
            self._persist_coaching_insight(user_id, new_insight)

        # Output safety scan
        response_text = json.dumps(response_data, ensure_ascii=False)
        scan_result = self._scanner.scan_output(response_text)
        if not scan_result.safe:
            logger.warning(
                "Output blocked for user %s: group=%s severity=%s",
                user_id,
                scan_result.group,
                scan_result.severity,
            )
            blocked = dict(_BLOCKED_RESPONSE_TEMPLATE)
            if scan_result.substitute_message:
                blocked["message"] = scan_result.substitute_message
            return blocked

        current_user_snapshot = self._load_current_user_snapshot(user_id)
        profile_snapshot = (
            profile_dto.model_dump() if hasattr(profile_dto, "model_dump") else {}
        )
        response_data = self._sanitize_own_pii_unsolicited(
            response_data=response_data,
            user_message=messages[-1].get("content", "") if messages else "",
            current_user=current_user_snapshot,
            profile_snapshot=profile_snapshot,
        )

        if debug:
            response_data["_debug"] = self._build_debug_payload(
                system_prompt=system_prompt,
                context_block=context_block,
                prompt=prompt,
                raw_llm_response=raw,
                schema_valid=schema_valid,
                profile_dto=profile_dto,
            )

        return response_data

    def _load_current_user_snapshot(self, user_id: str) -> dict[str, Any]:
        from app.db.repository import get_user_by_id  # noqa: PLC0415

        user = get_user_by_id(self.db, user_id)
        if user is None:
            return {}
        return {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }

    def _sanitize_own_pii_unsolicited(
        self,
        response_data: dict[str, Any],
        user_message: str,
        current_user: dict[str, Any],
        profile_snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        from app.coaching.safety import sanitize_unsolicited_profile_details  # noqa: PLC0415

        sanitized = sanitize_unsolicited_profile_details(
            response=response_data,
            user_message=user_message,
            current_user=current_user,
            profile_snapshot=profile_snapshot,
        )
        if not sanitized.get("message", "").strip():
            fallback = dict(_BLOCKED_RESPONSE_TEMPLATE)
            fallback["message"] = (
                "Ti rispondo senza ripetere dati del tuo profilo che non hai chiesto esplicitamente."
            )
            return fallback
        return sanitized

    def _persist_coaching_insight(self, user_id: str, new_insight: dict) -> None:
        """Persist a coaching insight with topic-based dedup.

        Phase 20: if new_insight has a `topic` field, upsert by topic (update existing
        entry rather than appending a duplicate). Falls back to append-only for
        legacy insights without `topic`.

        Non-fatal: logs and swallows any DB error so a failed write does not
        block the chat response.
        """
        try:
            from datetime import UTC, datetime  # noqa: PLC0415
            from app.db.repository import get_user_profile  # noqa: PLC0415

            profile = get_user_profile(self.db, user_id)
            if profile is None:
                return
            existing: list = list(profile.coaching_insights or [])
            now_iso = datetime.now(UTC).isoformat()
            topic = new_insight.get("topic")

            if topic:
                # Phase 20: dedup by topic — update existing entry if found
                for i, ci in enumerate(existing):
                    if ci.get("topic") == topic:
                        existing[i] = {
                            **new_insight,
                            "created_at": ci.get("created_at", ci.get("captured_at", now_iso)),
                            "updated_at": now_iso,
                        }
                        break
                else:
                    existing.append({**new_insight, "created_at": now_iso, "updated_at": now_iso})
            else:
                # Legacy format: append-only
                existing.append({**new_insight, "captured_at": now_iso})

            # Prune insights older than 180 days
            cutoff = (datetime.now(UTC).timestamp()) - (180 * 86400)
            pruned = []
            for ci in existing:
                ts_str = ci.get("created_at") or ci.get("captured_at") or ""
                try:
                    ts = datetime.fromisoformat(ts_str).timestamp()
                    if ts >= cutoff:
                        pruned.append(ci)
                except (ValueError, TypeError):
                    pruned.append(ci)  # keep if unparseable

            profile.coaching_insights = pruned
            profile.updated_at = datetime.now(UTC)
            self.db.commit()
        except Exception as exc:
            logger.warning(
                "Could not persist coaching insight for user %s: %s", user_id, exc
            )
            try:
                self.db.rollback()
            except Exception:
                pass

    def _tool_executor(
        self, locale: str, nationalities: list[str] | None = None, user_id: str | None = None
    ):
        """Return a closure that executes LLM tool calls for this coaching request."""
        _nations = nationalities or ["IT"]

        def execute(name: str, arguments: dict):
            if name == "search_content":
                query = arguments.get("query", "")
                req_locale = arguments.get("locale", locale)
                top_k = int(arguments.get("top_k", 5))
                content_types = arguments.get("content_types") or None
                return search_content(query, req_locale, top_k, content_types)
            if name == "search_regional_knowledge":
                query = arguments.get("query", "")
                top_k = int(arguments.get("top_k", 3))
                # Explicit nation overrides user default; None searches all nations in DB
                explicit_nation = arguments.get("nation")
                nations = [explicit_nation.upper()] if explicit_nation else _nations
                return search_regional_knowledge(query, nations=nations, top_k=top_k)
            if name == "get_timeline_events":
                if not user_id:
                    return []
                from app.db.repository import get_timeline_events as _get_evts  # noqa: PLC0415
                types_filter = arguments.get("types") or []
                events = _get_evts(self.db, user_id, include_dismissed=False)
                results = []
                for e in events:
                    if not e.is_user_dismissed:
                        if types_filter and e.event_type not in types_filter:
                            continue
                        results.append({
                            "event_type": e.event_type,
                            "event_date": str(e.event_date),
                            "title": e.title,
                            "description": e.description,
                            "evidence": e.evidence_json,
                        })
                return results
            # Phase 20: user profile, transactions, preferences, insights
            if name == "get_user_profile":
                if not user_id:
                    return {}
                try:
                    from app.services.profile_service import ProfileService  # noqa: PLC0415
                    from app.db.models import UserProfile as _UP  # noqa: PLC0415
                    profile = self.db.query(_UP).filter_by(user_id=user_id).first()
                    if not profile:
                        return {"error": "no profile"}
                    inc = profile.income_summary or {}
                    cats = profile.category_totals or {}
                    top3 = sorted(cats.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
                    expenses = profile.monthly_expenses or 0
                    income_avg = inc.get("amount") or inc.get("income_max") or 0
                    return {
                        "monthly_income_range": [inc.get("income_min"), inc.get("income_max")],
                        "monthly_income_avg": income_avg,
                        "monthly_expenses": expenses,
                        "monthly_margin": profile.monthly_margin,
                        "savings_rate_pct": round((income_avg - expenses) / income_avg * 100, 1) if income_avg else None,
                        "top_spending_categories": [{"name": k, "amount": round(v, 2)} for k, v in top3],
                        "verified_income_sources": profile.verified_income_sources or [],
                        "fixed_expenses": profile.fixed_expenses or [],
                        "extraordinary_income_total": profile.extraordinary_income_total,
                        "months_covered": profile.months_covered,
                    }
                except Exception as exc:
                    return {"error": str(exc)}
            if name == "search_user_transactions":
                if not user_id:
                    return []
                try:
                    from app.db.models import Transaction as _Txn  # noqa: PLC0415
                    query_str = arguments.get("query", "")
                    category = arguments.get("category")
                    limit = int(arguments.get("limit", 10))
                    q = self.db.query(_Txn).filter(_Txn.user_id == user_id)
                    if category:
                        q = q.filter(_Txn.category == category)
                    txns = q.order_by(_Txn.date.desc()).limit(500).all()
                    # Simple keyword filtering (BM25 overkill for per-user <500 txns)
                    kw = query_str.lower().split()
                    matched = []
                    for t in txns:
                        desc = (t.description or "").lower()
                        if any(k in desc for k in kw):
                            matched.append({
                                "date": str(t.date) if t.date else None,
                                "amount": float(t.amount) if t.amount else None,
                                "category": t.category,
                                "description": t.description,
                            })
                            if len(matched) >= limit:
                                break
                    return matched
                except Exception:
                    return []
            if name == "get_user_preferences":
                if not user_id:
                    return {"goals": [], "dos": [], "donts": []}
                try:
                    from app.db.models import UserProfile as _UP2  # noqa: PLC0415
                    profile = self.db.query(_UP2).filter_by(user_id=user_id).first()
                    if not profile:
                        return {"goals": [], "dos": [], "donts": []}
                    return {
                        "goals": getattr(profile, "goals", None) or [],
                        "dos": getattr(profile, "dos", None) or [],
                        "donts": getattr(profile, "donts", None) or [],
                    }
                except Exception:
                    return {"goals": [], "dos": [], "donts": []}
            if name == "recall_past_insights":
                if not user_id:
                    return []
                try:
                    from app.db.models import UserProfile as _UP3  # noqa: PLC0415
                    profile = self.db.query(_UP3).filter_by(user_id=user_id).first()
                    if not profile:
                        return []
                    insights = profile.coaching_insights or []
                    topic_kw = arguments.get("topic", "").lower().split()
                    matched = []
                    for ci in insights:
                        text = f"{ci.get('headline','')} {ci.get('data_point','')} {ci.get('topic','')}".lower()
                        if any(k in text for k in topic_kw):
                            matched.append(ci)
                    return matched[:5]
                except Exception:
                    return []
            raise ValueError(f"Unknown tool: {name!r}")

        return execute

    def _build_debug_payload(
        self,
        system_prompt: str,
        context_block: str,
        prompt: str,
        raw_llm_response: str,
        schema_valid: bool,
        profile_dto: Any,
    ) -> dict:
        """Build a debug info dict to attach to the response when LLM_DEBUG=true."""
        profile_snapshot: dict = {}
        try:
            profile_snapshot = (
                profile_dto.model_dump() if hasattr(profile_dto, "model_dump") else {}
            )
        except Exception:
            pass

        trace_dict: dict = {}
        try:
            trace = getattr(self.llm, "last_call_trace", None)
            if trace is not None:
                trace_dict = trace.to_dict()
        except Exception:
            pass

        return {
            "system_prompt": system_prompt,
            "context_block": context_block,
            "full_prompt": prompt,
            "raw_llm_response": raw_llm_response,
            # legacy field kept for backwards compat
            "model_used": trace_dict.get("model_used")
            or getattr(self.llm, "last_provider_used", "unknown"),
            "schema_valid": schema_valid,
            "profile_snapshot": profile_snapshot,
            # new richer fields
            "call_trace": trace_dict,
        }

    def _load_soul(self, persona_id: str) -> str:
        for persona in self._persona_config.get("personas", []):
            if persona["id"] == persona_id:
                soul_path = PERSONAS_DIR / persona["soulFile"]
                return soul_path.read_text(encoding="utf-8")
        # Fallback: default persona
        for persona in self._persona_config.get("personas", []):
            if persona["id"] == _DEFAULT_PERSONA_ID:
                soul_path = PERSONAS_DIR / persona["soulFile"]
                return soul_path.read_text(encoding="utf-8")
        return ""

    def _render_system(self, soul: str, locale: str) -> str:
        tmpl = self._jinja_env.get_template("system_base.j2")
        return tmpl.render(
            ethos=self._ethos,
            soul=soul,
            boundaries=self._boundaries,
            allowlist=self._allowlist,
            locale=locale,
        )

    def _render_context(self, profile_dto, user_id: str | None = None) -> str:
        tmpl = self._jinja_env.get_template("context_block.j2")
        # UserProfileDTO uses aliases but also supports snake_case via populate_by_name
        income_summary = getattr(profile_dto, "income_summary", None)
        category_totals = getattr(profile_dto, "category_totals", {})
        insight_cards = getattr(profile_dto, "insight_cards", [])
        coaching_insights = getattr(profile_dto, "coaching_insights", [])
        monthly_expenses = getattr(profile_dto, "monthly_expenses", None)
        monthly_margin = getattr(profile_dto, "monthly_margin", None)
        # Extract income sources from questionnaire answers if present
        questionnaire_answers = (
            getattr(profile_dto, "questionnaire_answers", None) or {}
        )
        income_sources = (
            questionnaire_answers.get("incomeSources")
            or questionnaire_answers.get("income_sources")
            or []
        )
        context = tmpl.render(
            income_summary=income_summary,
            monthly_expenses=monthly_expenses,
            monthly_margin=monthly_margin,
            category_totals=category_totals or {},
            insight_cards=insight_cards or [],
            coaching_insights=coaching_insights or [],
            income_sources=income_sources,
        )
        # Phase 19: inject timeline block when events exist
        if user_id:
            try:
                from app.db.repository import get_timeline_events  # noqa: PLC0415
                events = get_timeline_events(self.db, user_id, include_dismissed=False)
                recent_events = [
                    e for e in events
                    if not e.is_user_dismissed
                ][:3]
                if recent_events:
                    timeline_tmpl = self._jinja_env.get_template("timeline_block.j2")
                    timeline_block = timeline_tmpl.render(
                        timeline_events=[
                            {
                                "event_type": e.event_type,
                                "event_date": str(e.event_date),
                                "title": e.title or e.event_type,
                                "description": e.description,
                            }
                            for e in recent_events
                        ]
                    )
                    context += timeline_block
            except Exception:
                pass  # Timeline injection is best-effort
        return context

    def _render_response_format(self) -> str:
        tmpl = self._jinja_env.get_template("response_format.j2")
        return tmpl.render(
            capabilities_json=json.dumps(
                self._capabilities, indent=2, ensure_ascii=False
            ),
            a2ui_reference=self._a2ui_reference,
        )

    def _build_prompt(
        self, messages: list[dict], context_block: str, response_format: str
    ) -> str:
        """Build the full conversation prompt string."""
        parts = [context_block, "\n---\n"]
        # Include conversation history
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            parts.append(f"[{role.upper()}]: {content}")
        parts.append("\n---\n")
        parts.append(response_format)
        return "\n".join(parts)

    def _repair_response(self, data: dict) -> dict:
        """Ensure required fields exist; fill defaults if missing."""
        data.setdefault("message", "")
        if not data.get("reasoning_used"):
            data["reasoning_used"] = [
                {"step": "Analisi", "detail": "Risposta generata."}
            ]
        data.setdefault("action_cards", [])
        data.setdefault("resource_cards", [])
        data.setdefault("learn_cards", [])
        return data

    def _inject_fallback_cards(self, data: dict, locale: str) -> None:
        """
        If the LLM returned empty resource_cards or action_cards after a coaching
        response (not a blocked response), inject sensible defaults from the catalog.
        Called only when the response is non-empty (has a message).
        This is a safety net - the prompt should prevent empty cards on financial questions.

        Trigger condition (skip if ANY of these is true):
          - message is very short (< 15 chars) - pure greetings, one-word replies
          - affordability_verdict is absent/null - response is conversational, not financial
        This avoids injecting cards into short natural Italian questions like
        "Posso comprarlo?" (16 chars) that ARE financial decisions.
        """
        message = data.get("message", "")
        verdict = data.get("affordability_verdict")
        # Skip for very short messages (greetings / one-liners under 15 chars)
        if len(message) < 15:
            return
        # Skip for conversational responses that have no affordability verdict
        # (these are informational answers, not financial decisions)
        if verdict is None:
            return

        if not data.get("resource_cards"):
            # Inject top-1 article or video from catalog in the correct locale
            results = search_content(
                "educazione finanziaria risparmio budget", locale, top_k=2
            )
            if results:
                top = results[0]
                card: dict = {
                    "title": top["title"],
                    "summary": top["summary"],
                    "resource_type": top["type"]
                    if top["type"] in ("article", "video", "slide_deck")
                    else "article",
                    "url": top.get("url"),
                }
                if top.get("video_id"):
                    card["video_id"] = top["video_id"]
                    card["resource_type"] = "video"
                if top.get("slide_count"):
                    card["slide_id"] = top["id"]
                    card["resource_type"] = "slide_deck"
                data["resource_cards"] = [card]
                logger.debug("fallback resource_card injected: %s", top["id"])

        if not data.get("action_cards"):
            # Inject a generic partner funnel card from the catalog
            partner_results = search_content(
                "conto corrente risparmio",
                locale,
                top_k=1,
                content_types=["partner_offer"],
            )
            if partner_results:
                partner = partner_results[0]
                data["action_cards"] = [
                    {
                        "title": partner["title"],
                        "description": partner["summary"],
                        "action_type": "funnel",
                        "cta_label": "Scopri" if locale == "it" else "Discover",
                        "payload": {
                            "funnel_id": partner["id"],
                            "partner_name": partner.get(
                                "partner_name", partner["title"]
                            ),
                            "offer_type": partner.get("offer_type", "conto_corrente"),
                            "cta_url": partner.get("url"),
                        },
                    }
                ]
                logger.debug("fallback action_card injected: %s", partner["id"])


def get_coaching_service(
    db: Session, llm_client: Optional[LLMClient] = None
) -> CoachingService:
    """FastAPI dependency factory for CoachingService."""
    from app.ingestion.llm import get_llm_client

    if llm_client is None:
        llm_client = get_llm_client()
    return CoachingService(db=db, llm_client=llm_client)

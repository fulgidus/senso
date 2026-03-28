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
from app.ingestion.llm import LLMClient, LLMError
from app.services.profile_service import ProfileError, ProfileService

logger = logging.getLogger(__name__)

# Module-level cache so it survives across request-scoped CoachingService instances.
_welcome_cache: dict[str, str] = {}

COACHING_DIR = Path(__file__).parent
PERSONAS_DIR = COACHING_DIR.parent / "personas"
SCHEMAS_DIR = COACHING_DIR / "schemas"
PROMPTS_DIR = COACHING_DIR / "prompts"

_SUPPORTED_LOCALES = {"it", "en"}
_DEFAULT_LOCALE = "it"
_DEFAULT_PERSONA_ID = "mentore-saggio"
# Phase 4: only default persona supported
_ALLOWED_PERSONAS = {"mentore-saggio"}

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

    def get_welcome(
        self,
        user_id: str,
        first_name: str | None = None,
        locale: str = _DEFAULT_LOCALE,
    ) -> str:
        """
        Generate a short, warm, personalised welcome message for the chat screen.
        Uses the LLM directly - no profile required (graceful fallback if unavailable).

        Results are cached in-memory keyed on (user_id, first_name, locale) so repeated
        mounts / new-conversation calls don't fire a fresh LLM call.

        Returns a plain string.
        """
        locale = locale if locale in _SUPPORTED_LOCALES else _DEFAULT_LOCALE

        # ── Cache lookup ──────────────────────────────────────────────────────
        cache_key = hashlib.md5(
            f"{user_id}:{first_name or ''}:{locale}".encode()
        ).hexdigest()
        if cache_key in _welcome_cache:
            return _welcome_cache[cache_key]

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

        soul_text = self._load_soul(_DEFAULT_PERSONA_ID)
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

        _welcome_cache[cache_key] = result
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

        # Render templates
        system_prompt = self._render_system(soul_text, locale)
        context_block = self._render_context(profile_dto)
        response_format = self._render_response_format()

        # Build conversation prompt
        prompt = self._build_prompt(messages, context_block, response_format)

        # Call LLM
        raw: str = ""
        try:
            raw = self.llm.complete(
                prompt=prompt,
                system=system_prompt,
                json_mode=True,
                timeout=45.0,
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
            # Attempt partial repair: ensure required fields exist
            response_data = self._repair_response(response_data)

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

    def _render_context(self, profile_dto) -> str:
        tmpl = self._jinja_env.get_template("context_block.j2")
        # UserProfileDTO uses aliases but also supports snake_case via populate_by_name
        income_summary = getattr(profile_dto, "income_summary", None)
        category_totals = getattr(profile_dto, "category_totals", {})
        insight_cards = getattr(profile_dto, "insight_cards", [])
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
        return tmpl.render(
            income_summary=income_summary,
            monthly_expenses=monthly_expenses,
            monthly_margin=monthly_margin,
            category_totals=category_totals or {},
            insight_cards=insight_cards or [],
            income_sources=income_sources,
        )

    def _render_response_format(self) -> str:
        tmpl = self._jinja_env.get_template("response_format.j2")
        return tmpl.render(
            schema_json=json.dumps(self._response_schema, indent=2, ensure_ascii=False),
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


def get_coaching_service(
    db: Session, llm_client: Optional[LLMClient] = None
) -> CoachingService:
    """FastAPI dependency factory for CoachingService."""
    from app.ingestion.llm import get_llm_client

    if llm_client is None:
        llm_client = get_llm_client()
    return CoachingService(db=db, llm_client=llm_client)

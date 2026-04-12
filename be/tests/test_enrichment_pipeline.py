"""Tests for Phase 21 enrichment pipeline: gating, caps, quality gates."""
import pytest
from unittest.mock import MagicMock, patch


class TestGateEnrichments:
    """Test _gate_enrichments method on CoachingService."""

    def _make_service(self):
        from app.coaching.service import CoachingService
        mock_db = MagicMock()
        mock_llm = MagicMock()
        return CoachingService(db=mock_db, llm_client=mock_llm)

    def test_verdict_nullified_on_informational_question(self):
        svc = self._make_service()
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [],
            "affordability_verdict": {"verdict": "yes", "key_figures": [{"label": "a", "value": "b"}, {"label": "c", "value": "d"}]},
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="Cos'è l'IRPEF?", user_id="u1")
        assert result["affordability_verdict"] is None

    def test_verdict_kept_on_purchase_question(self):
        svc = self._make_service()
        verdict = {"verdict": "yes", "key_figures": [{"label": "a", "value": "b"}, {"label": "c", "value": "d"}]}
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [],
            "affordability_verdict": verdict,
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="Posso comprare una moto?", user_id="u1")
        assert result["affordability_verdict"] is not None

    def test_content_cards_stripped_without_search_content(self):
        svc = self._make_service()
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [{"title": "a", "card_type": "article"}],
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="ciao", user_id="u1")
        assert result["content_cards"] == []

    def test_content_cards_kept_with_search_content(self):
        svc = self._make_service()
        cards = [{"title": "a", "card_type": "article"}]
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": cards,
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called={"search_content"}, user_message="ciao", user_id="u1")
        assert len(result["content_cards"]) == 1

    def test_content_cards_cap_applied(self):
        svc = self._make_service()
        cards = [{"title": f"c{i}", "card_type": "article"} for i in range(5)]
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": cards,
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called={"search_content"}, user_message="ciao", user_id="u1")
        assert len(result["content_cards"]) <= 2

    def test_transaction_evidence_stripped_without_tool(self):
        svc = self._make_service()
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": {"transactions": [{"date": "2026-01-01", "description": "Test", "amount": -50}]},
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="ciao", user_id="u1")
        assert result["transaction_evidence"] is None

    def test_tools_called_metadata_stripped(self):
        svc = self._make_service()
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": None,
            "goal_progress": None,
            "_tools_called": ["search_content"],
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="ciao", user_id="u1")
        assert "_tools_called" not in result

    def test_interactive_cards_capped_at_one(self):
        svc = self._make_service()
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [
                {"title": "r1", "description": "d1", "action_type": "reminder"},
                {"title": "r2", "description": "d2", "action_type": "reminder"},
            ],
            "affordability_verdict": None,
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called=set(), user_message="ciao", user_id="u1")
        assert len(result["interactive_cards"]) <= 1

    def test_evidence_rows_capped_at_five(self):
        svc = self._make_service()
        txns = [{"date": f"2026-01-{i:02d}", "description": f"tx{i}", "amount": -10*i} for i in range(1, 9)]
        data = {
            "message": "test",
            "reasoning_used": [{"step": "s", "detail": "d"}],
            "content_cards": [],
            "interactive_cards": [],
            "affordability_verdict": None,
            "transaction_evidence": {"transactions": txns},
            "goal_progress": None,
        }
        result = svc._gate_enrichments(data, tools_called={"search_user_transactions"}, user_message="ciao", user_id="u1")
        assert len(result["transaction_evidence"]["transactions"]) <= 5


class TestValidateA2ui:
    """Test _validate_a2ui quality gate."""

    def _make_service(self):
        from app.coaching.service import CoachingService
        mock_db = MagicMock()
        mock_llm = MagicMock()
        return CoachingService(db=mock_db, llm_client=mock_llm)

    def test_strips_panel_with_one_row(self):
        svc = self._make_service()
        a2ui = '{"type":"surfaceUpdate","surface":{"type":"card"}}\n{"type":"dataModelUpdate","updates":[{"path":"field1","value":"100"}]}\n{"type":"beginRendering"}'
        data = {"details_a2ui": a2ui}
        result = svc._validate_a2ui(data)
        assert result["details_a2ui"] is None

    def test_keeps_panel_with_two_rows(self):
        svc = self._make_service()
        a2ui = '{"type":"surfaceUpdate","surface":{"type":"card"}}\n{"type":"dataModelUpdate","updates":[{"path":"f1","value":"100"},{"path":"f2","value":"200"}]}\n{"type":"beginRendering"}'
        data = {"details_a2ui": a2ui}
        result = svc._validate_a2ui(data)
        assert result["details_a2ui"] is not None

    def test_null_a2ui_unchanged(self):
        svc = self._make_service()
        data = {"details_a2ui": None}
        result = svc._validate_a2ui(data)
        assert result["details_a2ui"] is None


class TestPhase21AcceptanceGate:
    """Integration tests matching VALIDATION.md acceptance gate."""

    def _make_service(self):
        from app.coaching.service import CoachingService
        from unittest.mock import MagicMock
        mock_db = MagicMock()
        mock_llm = MagicMock()
        return CoachingService(db=mock_db, llm_client=mock_llm)

    def test_informational_no_verdict_no_cards(self):
        svc = self._make_service()
        data = {
            "message": "Il TFR è il trattamento di fine rapporto...",
            "reasoning_used": [{"step": "Definizione", "detail": "Spiegazione del TFR"}],
            "content_cards": [{"title": "art", "card_type": "article"}],
            "interactive_cards": [],
            "affordability_verdict": {"verdict": "no", "key_figures": [
                {"label": "a", "value": "b"}, {"label": "c", "value": "d"}
            ]},
            "transaction_evidence": None,
            "goal_progress": None,
            "details_a2ui": None,
            "new_insight": None,
        }
        result = svc._gate_enrichments(
            data, tools_called=set(), user_message="cos'è il TFR?", user_id="u1",
        )
        assert result["affordability_verdict"] is None
        assert result["content_cards"] == []

    def test_purchase_verdict_and_capped_cards(self):
        svc = self._make_service()
        data = {
            "message": "Sì, puoi permettertelo...",
            "reasoning_used": [{"step": "Margine", "detail": "€620/mese"}],
            "content_cards": [{"title": f"c{i}", "card_type": "article"} for i in range(5)],
            "interactive_cards": [],
            "affordability_verdict": {"verdict": "yes", "key_figures": [
                {"label": "Costo moto", "value": "€3.500"},
                {"label": "Margine mensile", "value": "€620"},
            ]},
            "transaction_evidence": None,
            "goal_progress": None,
        }
        result = svc._gate_enrichments(
            data, tools_called={"search_content", "get_user_profile"},
            user_message="Posso comprare una moto usata?", user_id="u1",
        )
        assert result["affordability_verdict"] is not None
        assert result["affordability_verdict"]["verdict"] == "yes"
        assert len(result["content_cards"]) <= 2

    def test_a2ui_one_row_nullified(self):
        svc = self._make_service()
        a2ui_1row = (
            '{"type":"surfaceUpdate","surface":{"type":"card","title":"Dettagli"}}\n'
            '{"type":"dataModelUpdate","updates":[{"path":"margin","value":"€620"}]}\n'
            '{"type":"beginRendering"}'
        )
        data = {"details_a2ui": a2ui_1row}
        result = svc._validate_a2ui(data)
        assert result["details_a2ui"] is None

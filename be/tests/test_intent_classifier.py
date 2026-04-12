"""Tests for purchase intent classifier — Phase 21 D-03."""
import pytest
from app.coaching.intent import classify_purchase_intent


# 20 labeled test messages — classifier must get ≥18/20 correct (90%)
LABELED_MESSAGES = [
    # Purchase intent = True
    ("Posso comprare una moto usata?", True),
    ("Mi conviene prendere un nuovo telefono?", True),
    ("Ho abbastanza per una vacanza a luglio?", True),
    ("Can I afford a new laptop?", True),
    ("Should I buy a used car?", True),
    ("Posso permettermi un abbonamento in palestra?", True),
    ("Il mutuo da 150k è sostenibile per me?", True),
    ("Riesco a pagare le rate di un finanziamento?", True),
    ("Do I have enough to get a PS5?", True),
    ("Dovrei investire in un fondo?", True),
    # Informational = False
    ("Cos'è l'IRPEF?", False),
    ("Come funziona il TFR?", False),
    ("What is compound interest?", False),
    ("Spiegami la differenza tra ETF e fondi comuni", False),
    ("Che cosa sono le detrazioni fiscali?", False),
    ("How does a mortgage work?", False),
    ("Ciao, come stai?", False),
    ("Grazie per l'aiuto!", False),
    ("Qual è il mio margine mensile?", False),
    ("Tell me about the 50/30/20 rule", False),
]


@pytest.mark.parametrize("message,expected", LABELED_MESSAGES)
def test_intent_label(message: str, expected: bool):
    assert classify_purchase_intent(message) == expected


def test_accuracy_threshold():
    correct = sum(
        1 for msg, expected in LABELED_MESSAGES
        if classify_purchase_intent(msg) == expected
    )
    accuracy = correct / len(LABELED_MESSAGES)
    assert accuracy >= 0.9, f"Accuracy {accuracy:.0%} < 90%"


def test_empty_message():
    assert classify_purchase_intent("") is False
    assert classify_purchase_intent("  ") is False


def test_short_message():
    assert classify_purchase_intent("ok") is False

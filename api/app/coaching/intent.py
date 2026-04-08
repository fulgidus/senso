"""
Purchase intent classifier (no LLM, regex-based).

Classifies user messages as purchase-intent or informational.
Used to select the appropriate response schema:
  - purchase intent → full schema with affordability_verdict
  - informational → schema without affordability_verdict

Phase 21, Decision D-03.
"""
import re


# Italian purchase intent patterns
_IT_PURCHASE_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bposso\s+(comprare|permettermi|acquistare|prendere)\b", re.I),
    re.compile(r"\bmi\s+(conviene|posso\s+permettere)\b", re.I),
    re.compile(r"\bho\s+abbastanza\s+per\b", re.I),
    re.compile(r"\b(comprare|acquistare|prendere)\s+.{2,}", re.I),
    re.compile(r"\b(costa|costano|prezzo|spendere|spesa)\b.*\b(posso|dovrei|riesco)\b", re.I),
    re.compile(r"\b(posso|dovrei|riesco)\b.*\b(costa|costano|prezzo|spendere|spesa)\b", re.I),
    re.compile(r"\bme lo posso permettere\b", re.I),
    re.compile(r"\b\u00e8 (un buon|il momento|il caso di)\b.*\b(comprare|acquistare|investire)\b", re.I),
    re.compile(r"\b(budget|margine)\s+(per|sufficiente)\b", re.I),
    re.compile(r"\b(rata|rate|finanziamento|prestito|mutuo)\b.*\b(posso|riesco|sostenibile)\b", re.I),
    re.compile(r"\b(posso|riesco|sostenibile)\b.*\b(rata|rate|finanziamento|prestito|mutuo)\b", re.I),
    re.compile(r"\bdovrei\s+(comprare|investire|prendere)\b", re.I),
]

# English purchase intent patterns
_EN_PURCHASE_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bcan i (afford|buy|get|purchase)\b", re.I),
    re.compile(r"\bshould i (buy|get|purchase|invest in)\b", re.I),
    re.compile(r"\bdo i have enough (for|to buy|to get)\b", re.I),
    re.compile(r"\bis it (worth|a good idea to) (buying|getting|purchasing)\b", re.I),
    re.compile(r"\b(afford|budget for|save for)\b", re.I),
    re.compile(r"\b(mortgage|loan|installment|payment plan)\b.*\b(can|should|feasible)\b", re.I),
    re.compile(r"\b(can|should|feasible)\b.*\b(mortgage|loan|installment|payment plan)\b", re.I),
]

# Informational question patterns (strong negatives — override purchase if matched)
_INFORMATIONAL_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b(cos[\u2019\u2018']?\u00e8|che cos[\u2019\u2018']?\u00e8|cosa (significa|sono)|what is|what are|explain|define)\b", re.I),
    re.compile(r"\b(come funziona|how does|how do)\b", re.I),
    re.compile(r"\b(differenza tra|difference between)\b", re.I),
    re.compile(r"\b(spieg(a|ami)|raccont(a|ami)|dimmi di|tell me about)\b", re.I),
]


def classify_purchase_intent(message: str) -> bool:
    """
    Return True if the message expresses purchase/affordability intent.
    Return False for informational, educational, or conversational messages.
    """
    if not message or len(message.strip()) < 3:
        return False

    text = message.strip()

    # Strong negatives: informational questions override
    for pat in _INFORMATIONAL_PATTERNS:
        if pat.search(text):
            return False

    # Check purchase patterns
    for pat in _IT_PURCHASE_PATTERNS:
        if pat.search(text):
            return True

    for pat in _EN_PURCHASE_PATTERNS:
        if pat.search(text):
            return True

    return False

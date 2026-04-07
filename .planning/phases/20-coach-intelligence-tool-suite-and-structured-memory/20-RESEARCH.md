# Phase 20: Coach Intelligence - Tool Suite + Structured Memory — Research

**Researched:** 2026-04-06
**Domain:** Italian financial rules data, BM25 search, LLM tool calling, structured coaching memory
**Confidence:** HIGH (tax rules verified for 2025; engineering patterns from official docs)

---

## Summary

Phase 20 requires two distinct types of knowledge:

1. **Italian financial rules content** — actual 2025 data for IRPEF, INPS, bonuses, TFR, ISEE, etc. These numbers change annually; the 2024 values in the plan stub are now outdated. Key change: Legge di Bilancio L. 207/2024 made 3-bracket IRPEF permanent (no longer provisional). Regime forfettario threshold for redditi da lavoro dipendente raised from €30K to €35K.

2. **BM25 search and tool calling patterns** — already established in this codebase (`api/app/content/search.py`). The pattern is to extend, not rewrite.

**Primary recommendation:** Write `italy_rules.json` with verified 2025 data (provided below). Extend the existing BM25 pattern from `search.py`. Tool registration follows the existing `_SEARCH_CONTENT_TOOL` pattern.

---

## Italian Financial Rules — Verified 2025 Data

### IRPEF Brackets 2025 (permanent per L. 207/2024)
| Reddito | Aliquota |
|---------|----------|
| ≤ €28.000 | 23% |
| €28.001–€50.000 | 35% |
| > €50.000 | 43% |

No-tax area: ≤ €8.500 (dipendenti), ≤ €5.500 (pensionati), ≤ €4.000 (altri)
Detrazione per lavoro dipendente: scalare tra €8.500 e €55.000

### INPS Contributi 2025
- **Dipendenti privati:** 9,19% lavoratore + 23,81% datore = 33% totale
  - Prima fascia pensionabile: €55.448 (massimale pensionistico: €120.607)
- **Gestione Separata (freelance/P.IVA):** 26,07% (25% IVS + 1,07%)
  - Minimale contributivo GS: €18.555
- **Co.co.co.:** 35,03% (1/3 lavoratore, 2/3 committente)

### Bonus Cultura 2025 (Carta della Cultura Giovani)
- €500 per chi è nato nel 2006 + ISEE familiare ≤ €35.000
- +€500 extra (totale €1.000) se ha anche maturità 2024 con voto 100/100
- Richiesta: 31 gennaio → 30 giugno 2025 · Utilizzo fino: 31 dicembre 2025

### Bonus Psicologo 2025
- ISEE < €15.000 → €1.500 max · €15K–€30K → €1.000 · €30K–€50K → €500
- Massimo €50 per seduta · Domande: 15 settembre – 14 novembre 2025

### Bonus Affitti Giovani Under 31
- 20% del canone annuo · min €991,60 · max €2.000
- Reddito ≤ €15.493,71 · Durata: 4 anni dall'inizio contratto
- ⚠️ Nuovi contratti post 30/06/2025: normativa in transizione, verificare

### 730 / Dichiarazione Redditi 2025 (per redditi 2024)
- 730 precompilato: scadenza 30 settembre 2025
- Modello Redditi PF (P.IVA): scadenza 30 novembre 2025
- Disponibile online dal 30 aprile 2025

### TFR (Trattamento di Fine Rapporto)
- Formula: RAL ÷ 13,5 per anno di servizio
- Rivalutazione annua: 1,5% fisso + 75% dell'inflazione (indice ISTAT)
- Pagato alla cessazione rapporto per qualsiasi motivo
- Anticipo: dopo 8 anni (max 70% del maturato, solo cause specifiche)
- Tassazione separata (aliquota media IRPEF degli ultimi 5 anni, non scaglioni ordinari)
- Scelta: fondo pensione (deducibile fino €5.164,57/anno) vs liquidazione diretta in azienda

### ISEE 2025
- Dichiarazione Sostitutiva Unica (DSU) presentata a CAF o INPS online
- Valida 12 mesi dalla presentazione
- Soglie chiave per giovani: €15K (bonus psicologo max), €35K (carta cultura), €50K (bonus psicologo accesso)
- ISEE precompilato disponibile online · ISEE corrente per chi ha perso lavoro nell'anno

### Regime Forfettario 2025
- Cap ricavi: €85.000 · Aliquota: 15% (5% primi 5 anni nuova attività, se mai avuto P.IVA)
- Reddito imponibile = Ricavi × Coefficiente ATECO (es. professionisti e consulenti: 78%)
- Contributi INPS Gestione Separata: 26,07% sul reddito imponibile (dedotti prima di IRPEF)
- **Novità 2025:** escluso dal forfettario chi ha redditi da lavoro dipendente > €35.000 (era €30K)
- Non applicabile se: si supera €85K nell'anno, si partecipa a SRL con controllo, si hanno dipendenti > €20K

### Affitti — Cedolare Secca e Detrazioni
- Cedolare secca libero mercato: 21% · Canone concordato: 10% · Locazioni brevi (>1 immobile): 26%
- Detrazione inquilino mercato libero: €300 (reddito ≤ €15.493,71) / €150 (€15K–€30.987,41)
- Detrazione canone concordato: €495,80 / €247,90

### Bonus Mobili 2025
- 50% su spesa max €5.000 = max €2.500 di risparmio
- Ripartito in 10 rate annuali da 730/Redditi
- Richiede ristrutturazione del medesimo immobile iniziata dal 1° gennaio 2024
- Scade 31/12/2025 · Probabilmente non prorogato al 2026

---

## BM25 Extension Pattern (Don't Hand-Roll)

The codebase already has `api/app/content/search.py` with `build_content_index()` and `search_content()`. Italy rules follow the exact same pattern:

```python
# Extend search.py — same pattern as content index
_italy_index: BM25Okapi | None = None
_italy_items: list[dict] = []

def build_italy_rules_index() -> None:
    global _italy_index, _italy_items
    path = Path(__file__).parent / "italy_rules.json"
    _italy_items = json.loads(path.read_text())
    corpus = [f"{r['title']} {r['summary']} {' '.join(r['topics'])}"
              for r in _italy_items]
    _italy_index = BM25Okapi([doc.split() for doc in corpus])
```

Call `build_italy_rules_index()` in `main.py` lifespan alongside `build_content_index()`.

## Tool Registration Pattern (Existing)

Read `api/app/coaching/service.py` for `_SEARCH_CONTENT_TOOL` schema and `_tool_executor()`. Italy rules tool follows the same schema + executor dict pattern.

---

## Common Pitfalls

### Pitfall 1: Stale Tax Data
**What goes wrong:** Using 2024 data — IRPEF was provisional in 2024, permanently 3-bracket in 2025.
**How to avoid:** Use the data in this RESEARCH.md (verified against L. 207/2024).

### Pitfall 2: Italy Rules BM25 Not Locale-Filtered
**What goes wrong:** English query matches Italian entries poorly.
**How to avoid:** Filter by `locale` before BM25 scoring. All entries should have `"locale": "it"`.

### Pitfall 3: Tool Bloat in System Prompt
**What goes wrong:** Listing 7 tools inflates system prompt. LLM picks wrong tool.
**How to avoid:** Tool descriptions should be 1 sentence. Use `description` to guide selection.

### Pitfall 4: Insight Dedup Race
**What goes wrong:** Same insight appended multiple times in concurrent requests.
**How to avoid:** Use `UPSERT ... ON CONFLICT` or row-level lock in `ProfileService`.

---

## Sources

- IRPEF 2025: Legge di Bilancio 2025 (L. 207/2024), MEF communication
- INPS contributi: Circolare INPS n. 24/2025
- Bonus cultura: Ministero della Cultura / 18app.italia.it
- Bonus psicologo: INPS comunicato settembre 2025
- Bonus affitti giovani: Agenzia delle Entrate, DL 3/2023 art. 6-ter
- Regime forfettario: Legge di Bilancio 2025, Agenzia delle Entrate
- TFR: art. 2120 c.c. + DLgs 252/2005 (fondi pensione)

**Confidence:** HIGH for IRPEF/INPS (official legislative sources). MEDIUM for bonus affitti (normativa in transizione post-giugno 2025).

**Research date:** 2026-04-06
**Valid until:** 2026-12-31 (next Legge di Bilancio may update thresholds)

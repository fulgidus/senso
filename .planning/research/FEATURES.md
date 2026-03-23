# Feature Research

**Domain:** AI financial education/coaching assistant for ages 18–30 (voice-first)
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Personal finance data ingestion (bank connections or uploads) | All successful products start from real transaction data, not generic tips | MEDIUM | For SENSO v1, upload-based ingestion is acceptable; direct connectors can follow |
| Automatic transaction categorization + spending breakdown | Core expectation in modern money apps (Rocket Money, Monarch, Copilot) | MEDIUM | Needs good merchant normalization + fallback manual correction |
| Recurring charges/subscription detection | Users now expect “find where my money leaks” by default | MEDIUM | High perceived value; can be rules-based before advanced ML |
| Budget/cashflow visibility with alerts | Preventing overdraft/surprise bills is baseline utility | MEDIUM | Keep lightweight in v1 (simple monthly margin + risk alerts) |
| Goal setup and progress tracking | “Save for X” framing is standard and sticky | MEDIUM | Must connect directly to coaching recommendations |
| Personalized coaching response grounded in user numbers | In AI coaching category, generic advice breaks trust immediately | HIGH | Must show reasoning trace (“based on income/spend/debt”) every time |
| Safety and compliance guardrails | Financial advice products must avoid harmful/regulated overreach | HIGH | Include disclaimers, refusal policy, and escalation boundaries |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Voice-first “Can I buy this?” decision coach | Fast, emotionally resonant interaction for 18–30 audience; stronger demo impact than dashboard UX | HIGH | SENSO’s primary wedge; keep a text fallback for reliability |
| Transparent recommendation anatomy (numbers + reasoning + tradeoff) | Builds trust and teaches financial thinking, not just yes/no verdicts | MEDIUM | Must be enforced by response schema, not prompt-only |
| Persona-driven mentor styles with shared safety core | Engagement lift without changing financial correctness | MEDIUM | Distinguish tone from policy: one decision engine, many delivery styles |
| Action cards per answer (Learn + Act) | Converts insight into immediate behavior change (education + concrete next step) | MEDIUM | Pair each recommendation with 1 learning resource + 1 practical action |
| Adaptive “roadmap” coaching over time | Moves from one-off Q&A to ongoing habit formation | HIGH | Defer full autonomy; start with weekly “next best action” summaries |
| Gamified self-awareness loops (quiz/challenge style) | Proven engagement pattern with younger users (e.g., Money IQ style) | MEDIUM | Best after core trust loop is stable |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full dashboard-first analytics suite in MVP | Feels “complete” and familiar to fintech judges/users | Dilutes core value (decision coaching), high build cost, weak differentiation | Minimal profile snapshot + conversational decision flow |
| Fully autonomous money movement in v1 (auto-transfer/auto-pay without confirmation) | “AI autopilot” sounds advanced | Safety/trust/regulatory risk too high for first release | Recommendation mode + explicit user confirmation actions |
| Investment-picking/market timing advice for launch | Frequently requested in finance apps | High legal/suitability risk and weak alignment with immediate spending decisions | Focus on budgeting, debt/rate understanding, emergency fund behaviors |
| Heavy open-banking integration during hackathon MVP | Seen as “real fintech” requirement | Integration friction jeopardizes demo reliability | File-upload ingestion first, connectors post-validation |

## Feature Dependencies

```text
[Data ingestion + parsing]
    └──requires──> [Profile normalization]
                        └──requires──> [Personalized coaching grounded in numbers]
                                                └──requires──> [Reasoning trace output]

[Recurring/subscription detection] ──enhances──> ["Can I buy this?" decision quality]

[Knowledge base retrieval] ──requires──> [Action cards: Learn]
[Service/partner catalog matching] ──requires──> [Action cards: Act]

[Persona style layer] ──requires──> [Safety boundaries + policy guardrails]

[Voice UX] ──conflicts (in MVP scope/time)──> [Complex dashboard analytics buildout]
```

### Dependency Notes

- **Personalized coaching requires normalized profile data:** without clean income/expense/debt structure, answers become generic and low-trust.
- **Reasoning trace requires structured decision output:** must serialize “inputs used, constraints, recommendation, tradeoff.”
- **Action cards require retrieval + matching subsystems:** educational links and concrete actions should come from different pipelines.
- **Persona layer requires shared policy core:** tone can vary; financial boundaries cannot.
- **Voice-first conflicts with dashboard-heavy MVP:** both are UX-heavy; prioritize one to preserve demo reliability.

## MVP Definition

### Launch With (v1)

Minimum viable product — what’s needed to validate the concept.

- [ ] Document upload ingestion (CSV + payslip/receipt image) with structured profile extraction — prerequisite for personalization
- [ ] “Can I buy this?” voice/text query with grounded answer — core user moment
- [ ] Mandatory reasoning transparency block in every answer — trust + educational value
- [ ] Action cards: one learning resource + one concrete next action — behavior change loop
- [ ] Safety boundaries + refusal patterns + disclaimers — prevents harmful guidance
- [ ] Lightweight session/auth persistence — preserves continuity for demo and early users

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Recurring/subscription detector with reminder alerts — add once ingestion accuracy is stable
- [ ] Goal tracking with monthly progress nudges — add once coaching retention is proven
- [ ] Expanded persona set + personalization controls — add once baseline response quality is consistent
- [ ] Basic bank connector(s) for top institutions — add once upload-first funnel validates demand

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Semi-autonomous action execution (user-approved automations) — requires mature trust/compliance controls
- [ ] Gamified weekly money challenges/quiz loops — useful growth lever after core utility is strong
- [ ] Deep partner marketplace optimization/funnel analytics — monetize after behavior-change value is proven

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Upload-based financial profile extraction | HIGH | MEDIUM | P1 |
| Grounded purchase decision coaching | HIGH | HIGH | P1 |
| Reasoning transparency block | HIGH | MEDIUM | P1 |
| Learn + Act action cards | HIGH | MEDIUM | P1 |
| Safety/policy guardrails | HIGH | HIGH | P1 |
| Recurring/subscription detection | HIGH | MEDIUM | P2 |
| Goal tracking | MEDIUM-HIGH | MEDIUM | P2 |
| Persona expansion/gamification | MEDIUM | MEDIUM | P3 |
| Autonomous financial actions | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A (Cleo) | Competitor B (Rocket Money) | Our Approach (SENSO) |
|---------|----------------------|------------------------------|----------------------|
| Conversational coaching | Strong personality + chat/voice positioning | Limited; more utility tooling | Voice-first mentor with explicit financial reasoning |
| Spending visibility | Present | Strong core offering | Keep concise (profile + margin), avoid dashboard bloat in v1 |
| Subscription detection | Not primary marketing focus | Core strength | Add in v1.x, tied to coaching prompts |
| Goal automation | Autopilot roadmap framing | Autopilot savings feature | Start with recommendation-first roadmap, manual confirmation |
| Educational loop | Present via “Money IQ” style engagement | Secondary | Embed learning resource in every decision response |

## Sources

- Project context: `/home/fulgidus/Documents/senso/.planning/PROJECT.md` (HIGH)
- Product concept: `/home/fulgidus/Documents/senso/CONCEPT.md` (HIGH)
- Cleo main + Autopilot + Money IQ pages (official): https://web.meetcleo.com, https://web.meetcleo.com/autopilot, https://web.meetcleo.com/moneyiq (HIGH)
- Rocket Money feature pages (official): https://www.rocketmoney.com/feature/spending-insights, https://www.rocketmoney.com/feature/manage-subscriptions, https://www.rocketmoney.com/feature/autopilot-savings (HIGH)
- Copilot product page (official): https://www.copilot.money (MEDIUM-HIGH; marketing copy, limited technical detail)
- Monarch product pages (official): https://www.monarchmoney.com, https://www.monarchmoney.com/features/budgeting, https://www.monarchmoney.com/features/planning (HIGH)
- Market overview reference: NerdWallet “Best Budget Apps for 2026” https://www.nerdwallet.com/article/finance/best-budget-apps (MEDIUM; broad comparative source)

---
*Feature research for: AI financial education assistant (18–30)*
*Researched: 2026-03-23*

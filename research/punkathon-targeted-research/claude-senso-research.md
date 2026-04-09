# S.E.N.S.O. — Background Research & Idea Generation

> Prepared for the PUNKATHON hackathon (OGR Torino, 11 April 2026), sponsored by Banca Territori del Monviso (BTM).

---

## 1. Personal Finance Frameworks

### 1.1 The Four Pillars of Personal Finance

The "Four Pillars" framework appears in multiple variants across the personal finance literature. The two most common formulations are:

**Variant A — Stocks & Flows (DQYDJ / BigPay):** Assets, Debts, Income (inflows), and Expenses (outflows). The idea is that your entire financial life reduces to two "stocks" (what you have vs. what you owe) and two "flows" (what comes in vs. what goes out). Net worth = Assets − Debts; monthly cash flow = Income − Expenses. If both numbers trend positive, you're winning.

**Variant B — Behavioral (GOBankingRates / EFCU):** Budgeting, Saving, Investing, and Protection (insurance/estate planning). This version is more prescriptive — it tells you *what to do* rather than *what to measure*.

There is also **William Bernstein's "Four Pillars of Investing"** (2002), a classic book framing investment knowledge around Theory, History, Psychology, and Business (the finance industry). This is more academic and aimed at self-directed investors.

| Aspect | Best for | Strengths | Limitations |
|---|---|---|---|
| Stocks & Flows (A) | Beginners who need a mental model | Dead simple; works at any income | Doesn't prescribe action |
| Behavioral (B) | People ready to build habits | Actionable; covers insurance gap | Assumes stable income |
| Bernstein (Investing) | Intermediate/advanced investors | Deep; historically grounded | Not a budgeting framework; US-centric |

**Relevance to SENSO:** Variant A maps perfectly to the onboarding step — the AI digests uploads and presents assets, debts, income, expenses. Variant B maps to the coaching layer on top.

Sources: [DQYDJ](https://dqydj.com/the-four-pillars-of-personal-finance/), [GOBankingRates](https://www.gobankingrates.com/money/financial-planning/pillars-of-personal-finance/), [Efficient Frontier / Bernstein](https://www.efficientfrontier.com/t4poi/intro.htm)

---

### 1.2 The 15-65-20 Rule (and comparison to 50-30-20)

The **15-65-20 rule** splits after-tax income into:

- **15% → Savings & investments** (emergency fund first, then long-term)
- **65% → Essential living expenses** (rent, utilities, groceries, transport, insurance)
- **20% → Discretionary / enjoyment** (hobbies, dining out, entertainment)

Compare with the **50-30-20 rule** (Elizabeth Warren, *All Your Worth*, 2006):

- **50% → Needs**
- **30% → Wants**
- **20% → Savings & debt repayment**

| Dimension | 50-30-20 | 15-65-20 |
|---|---|---|
| Savings rate | 20% | 15% |
| Needs allowance | 50% | 65% |
| Wants allowance | 30% | 20% |
| Best for | People with moderate cost of living | People in high-cost areas or with tight margins |
| Philosophy | Save aggressively, cut wants | Be realistic about expenses, protect enjoyment |

The 15-65-20 is arguably more realistic for young Italian workers in cities like Turin or Milan, where rent alone can consume 40%+ of a low-to-medium salary. The 50-30-20 often fails because 50% doesn't cover essentials, leading people to abandon the framework entirely.

Sources: [Base Wealth Management](https://basewealthmanagement.com/financial-videos/can-the-15-65-20-budget-rule-boost-your-savings-fast/), [TechDrivePlay](https://techdriveplay.com/2024/11/04/what-is-the-15-65-20-rule-how-to-use-it-to-manage-your-money/), [UNFCU](https://www.unfcu.org/financial-wellness/50-30-20-rule/)

---

### 1.3 Other Relevant Frameworks

**60-30-10 Rule** (Kiplinger, 2026): 60% needs, 30% wants, 10% savings. Acknowledges that in today's inflated economy, most people simply cannot keep needs at 50%. The trade-off is a much lower savings rate, making it a better *starting point* than a *destination*. Financial planners note that saving 10% is still below the commonly recommended 15% for retirement.

**75-15-10 Rule**: 75% all spending (needs + wants combined), 15% investing, 10% emergency savings. Popularized on social media (TikTok/YouTube). Appeals to people who hate splitting needs from wants. The combined 25% toward future goals is solid, but 75% for spending can enable lifestyle creep if unmonitored.

**80-20 Rule ("Pay Yourself First"):** Simply save/invest 20%, spend 80% however you want. The ultimate low-friction approach. No categorization at all. Works well for disciplined people who just need one number to hit.

**Zero-Based Budget:** Every euro is assigned a purpose before the month begins. Most granular and effective for debt paydown, but highest maintenance burden. Apps like YNAB implement this.

**Relevance to SENSO:** The AI should be framework-agnostic. During onboarding, after analyzing real numbers, it can *suggest* which framework fits the user's situation rather than imposing one. A person earning €1,400/month in Turin with €900 in fixed costs is in a 15-65-20 or 60-30-10 world, not a 50-30-20 one.

Sources: [Kiplinger](https://www.kiplinger.com/personal-finance/the-new-603010-budgeting-method), [Thrivent on 75-15-10](https://www.thrivent.com/insights/budgeting-saving/the-75-15-10-budget-pros-cons-and-who-should-use-one)

---

## 2. Common Financial Mistakes Among Young Adults (18-30)

### 2.1 The Italian Context: A Financial Literacy Crisis

Italy consistently ranks near the bottom of OECD countries for financial literacy. Key data points:

- Only **16.6% of Italians** reach the OECD's minimum acceptable score of 70/100 for informed financial management (OECD/INFE 2023 survey, analyzed by Bravo/Il Sole 24 Ore).
- Only **17.2% of Italians** can distinguish between simple and compound interest — meaning the vast majority take on debt without understanding its mechanics.
- A 2023 Eurobarometer survey found that only **half of EU citizens** on average could answer at least 3 of 5 basic financial knowledge questions correctly. Italy scored below average.
- Italian 15-year-olds score 476 on PISA financial literacy (above OECD mean), but more than 20% are at Level 1 or below — unable to apply knowledge to real-life financial decisions.
- Financial education only entered Italian school curricula in 2024/25, with a paltry **7 hours per year** in upper secondary schools within civic education.
- The gender gap is severe: Italian adolescent girls lag 20 points behind boys in financial literacy, far exceeding the OECD average gap of 5 points.

Sources: [Il Sole 24 Ore (Nov 2025)](https://en.ilsole24ore.com/art/failed-debt-and-loans-italy-fund-ranking-financial-skills-AHCIxq8B), [Il Sole 24 Ore (Nov 2025)](https://en.ilsole24ore.com/art/financial-education-where-we-stand-compared-to-italy-and-some-eu-countries-AHBb2PuD), [Museo del Risparmio (Feb 2025)](https://www.museodelrisparmio.it/blog/young-people-and-financial-education-where-do-we-stand-in-italy/), [Bruegel Policy Brief](https://www.bruegel.org/policy-brief/state-financial-knowledge-european-union), [OECD/INFE 2023 Survey](https://www.oecd.org/en/publications/oecd-infe-2023-international-survey-of-adult-financial-literacy_56003a32-en.html)

### 2.2 Specific Mistake Patterns

**Impulse spending & subscription creep:** Young adults are the heaviest users of food delivery, streaming, and micro-subscription services. These individually small expenses (€9.99/month Spotify, €12.99 Netflix, €15 Deliveroo delivery fees) compound into hundreds of euros monthly that are often invisible because they're auto-charged. The SENSO concept correctly identifies this — the example of €280/month in food delivery is realistic for the target demographic.

**Buy-Now-Pay-Later (BNPL) trap:** BNPL usage in Italy has exploded from 4% to 30% of consumers between 2022 and 2025 (Bank of Italy / Format Research). Transaction volumes jumped from €0.4B in 2020 to €6.8B in 2024 (Politecnico di Milano), with a further 28% increase in H1 2025 (CRIF). The danger is layering: users can accumulate multiple parallel installment plans across different providers (Klarna, Scalapay, PayPal) without any single entity having visibility of total exposure, since BNPL is largely excluded from credit bureau reporting in Italy. Many younger users perceive BNPL as not-really-debt, but missed payments can result in a CRIF negative entry, jeopardizing future mortgage or car loan applications. A new EU Consumer Credit Directive (CCD2), enforceable from November 2026, will bring most BNPL under regulated consumer credit rules — but that's still months away.

**No emergency fund:** The OECD data shows that only about 30% of Italian adults save actively. For young workers on €1,200-1,600/month with high urban rents, building even a one-month buffer feels impossible — yet it's the single most impactful financial action they can take. Without one, any unexpected expense (car repair, medical bill, job loss) gets financed via credit card or BNPL, starting a debt spiral.

**Misunderstanding of interest rates and debt mechanics:** With 83% of Italians unable to distinguish simple from compound interest, installment purchases, credit card revolving balances, and loan products are used blindly. The "€30/month for 24 months" framing hides the total cost and the effective APR. This is exactly the educational gap SENSO is designed to fill.

**No budgeting habit:** Only about 40% of Italian 15-year-olds feel comfortable talking about money (vs. 50% OECD average). This discomfort carries into adulthood. Budgeting is seen as restrictive and boring — which is why voice-first, conversation-driven approaches like SENSO have an advantage over spreadsheet-based tools.

Sources: [Bank of Italy / Format Research (Mar 2026)](https://formatresearch.com/en/2026/03/25/buy-now-pay-later-caratteristiche-del-mercato-banca-ditalia/), [The Conservative (Nov 2025)](https://www.theconservative.online/europe-tightens-the-rules-on-buy-now-pay-later-what-the-2026-reform-means-for-consumers-and-platforms), [NSS Magazine (Apr 2025)](https://www.nssmag.com/en/lifestyle/40634/buy-now-pay-later-risks-opportunities-debt), [Motley Fool BNPL Report 2025](https://www.fool.com/money/research/buy-now-pay-later-statistics/), [Oliver Wyman CCD2 Analysis](https://www.oliverwyman.com/our-expertise/insights/2025/feb/impact-of-ccd2-on-buy-now-pay-later-services-in-europe.html)

---

## 3. Competitive Landscape: Small Cooperative Banks vs. Large Banks in Italy

### 3.1 Banca Territori del Monviso (BTM) — Profile

BTM is a Banca di Credito Cooperativo (BCC) headquartered in Carmagnola (TO), operating in the provinces of Cuneo and Torino. Key figures:

- **Founded:** Over 70 years ago (originally Credito Cooperativo di Casalgrasso e Sant'Albano Stura)
- **Branches:** 21 + a modern Centro Direzionale
- **Members (soci):** ~10,500
- **Clients:** ~30,000
- **Assets under management:** >€2.3 billion
- **CET1 Ratio (31 Dec 2025):** 30.60% — among the highest in the Italian banking system (for context, regulatory minimum is 4.5%, and most large banks target 12-14%)
- **Group:** Part of the Cassa Centrale Banca cooperative banking group (formed January 2019 under the 2016 reform)
- **Director General:** Luca Murazzano

**NEXT — BTM Young Community** (launched October 2025): A program targeting members and clients aged 18-30 (born after 1 January 1997). Structure includes: an Advisory Board of ~20 young members working in thematic groups (sustainability, solidarity, science & tech, education & finance, events/arts/culture/sport); Ambassadors who promote the community locally; free workshops (public speaking, social media, financial topics); and events co-organized with ScuolaZoo. The Advisory Board proposes projects that the bank evaluates and may fund. NEXT has already run multiple workshops and opened Advisory Board candidatures.

Sources: [bancabtm.it](https://www.bancabtm.it/chi-siamo/), [Targatocn (Oct 2025)](https://www.targatocn.it/2025/10/09/leggi-notizia/argomenti/economia-7/articolo/banca-territori-del-monviso-presenta-next-la-nuova-young-community-dedicata-ai-giovani-soci-b-1.html), [ANSA (Oct 2025)](https://www.ansa.it/sito/notizie/economia/risparmio_Investimenti/2025/10/26/la-banca-territori-del-monviso-crea-una-young-community_2886c41c-ca6c-4597-87dd-b5df172ed9b0.html), [Targatocn (Dec 2025)](https://www.targatocn.it/2025/12/22/leggi-notizia/argomenti/economia-7/articolo/al-via-le-candidature-per-ladvisory-board-next-btm-young-community.html)

### 3.2 BCC Advantages vs. Large Banks

Academic research and industry analysis consistently point to structural advantages that Italian cooperative banks (BCCs) have over large commercial banks (Intesa Sanpaolo, UniCredit):

**Proximity and soft information:** BCCs operate in narrow geographic markets with deep community roots. Branch managers know their clients personally. This "soft information" advantage allows better credit decisions for small businesses and individuals who look weak on paper but are solid in practice. Research shows BCCs outperform large banks in cost efficiency, partly due to this lean, relationship-based model.

**Democratic governance and member alignment:** Members are both owners and clients. There is no shareholder pressure for short-term profit maximization. This enables patient, community-oriented decision-making. BTM's NEXT program is a direct expression of this — large banks could never allow a group of 20 young clients to propose projects for the bank to fund.

**Financial stability:** BCCs tend to have much higher capital ratios (BTM's 30.6% CET1 is extraordinary) and lower risk appetites. Since owners are also depositors, there are fewer incentives to take excessive risk. Multiple studies show BCCs played a stabilizing role during the 2008-2009 financial crisis and subsequent crises.

**Local economic development:** Research demonstrates that higher BCC presence in Italian provinces correlates with higher rates of new business creation, particularly in high-tech sectors during stable economic periods.

**What large banks offer that BCCs typically can't:** Advanced digital banking platforms (Intesa's Isybank, UniCredit's mobile app), international presence, sophisticated investment products, scale for AI/ML R&D, lower per-unit technology costs, brand recognition among young digital natives.

**Realistic tech initiatives for a bank BTM's size:** A bank with 30,000 clients and 21 branches cannot build its own neo-bank platform. But it *can*: partner with fintechs for specific capabilities (e.g., ElevenLabs for voice AI); run focused experiments with its NEXT community as a pilot group; adopt white-label or open-source tools; and leverage its group infrastructure (Cassa Centrale Banca) for shared technology. A hackathon product like SENSO fits perfectly — it's a focused, high-impact experiment rather than a platform play.

Sources: [ScienceDirect — Bank efficiency and local market conditions](https://www.sciencedirect.com/science/article/abs/pii/S0148619515000508), [Wiley — Do cooperative banks matter for new business creation?](https://onlinelibrary.wiley.com/doi/10.1111/apce.12342), [Springer — Management Cost Efficiency](https://link.springer.com/article/10.1007/s13132-025-02612-0), [Cassa Centrale Banca — Our Roots](https://www.cassacentrale.it/en/group/our-roots)

---

## 4. Idea Generation

### 4a. Divergent Ideas (unfiltered brainstorm)

1. **SENSO (the current concept):** Voice-first AI financial mentor that ingests your real bank data, answers spending questions with your own numbers, and links to educational content + bank services.

2. **"Quanto Mi Costa Davvero"** (What It Really Costs Me): A single-purpose tool — you say or type a purchase, and the AI shows the real cost in terms of your hours worked, months of delayed savings goals, or total cost including BNPL interest. Zero onboarding, instant impact.

3. **BNPL X-Ray:** An AI tool that scans your BNPL accounts (Klarna, Scalapay, PayPal installments) and gives you a unified dashboard showing total exposure, upcoming payments, and projected cash flow impact. Teaches compound cost awareness.

4. **"Il Tabaccaio Digitale" (The Digital Corner Shop):** A WhatsApp/Telegram bot in local dialect that answers financial questions the way a trusted older neighbor would. Low-tech interface, high accessibility. No app to install.

5. **Subscription Audit Agent:** Connect your bank account or upload a CSV; the AI identifies all recurring charges, classifies them (essential / nice-to-have / forgot-about-it), and calculates annual cost. Generates a one-click cancellation plan.

6. **Financial "Time Machine":** Show users two futures — one where they continue current behavior, one where they make specific changes. Visualize net worth at age 30, 40, 50. Make compound interest tangible.

7. **Peer Benchmark (anonymized):** "People your age in your area earn X on average, save Y, and spend Z on categories A, B, C." Uses aggregate BTM data (anonymized) to create social context without judgment.

8. **Gamified Savings Challenges:** AI-generated weekly micro-challenges ("Skip delivery twice this week and move €20 to savings"). Progress tracked via voice check-ins. Leaderboards within the NEXT community.

9. **"Primo Stipendio" (First Paycheck) Simulator:** For students and new workers — input your expected salary and the AI walks you through setting up a budget, explaining taxes, contributi INPS, TFR, and what your net actually means. Interactive and visual.

10. **AI-Powered Financial Diary:** Daily 30-second voice check-in: "What did you spend today?" The AI builds your spending profile over time without requiring bank integration. Low friction, privacy-first.

11. **"Chiedi alla Banca" (Ask the Bank):** AI front-end for BTM's actual product catalog. Young clients ask natural-language questions ("Can I get a car loan?", "What savings account should I open?") and get answers grounded in BTM's real offerings, not generic advice.

12. **Community Financial Literacy Podcast Generator:** AI takes a financial topic + user questions from the NEXT community and generates a short audio episode with ElevenLabs voices. New episode weekly, distributed via BTM's channels.

13. **Receipt Scanner + Spending Coach:** Snap a photo of any receipt; AI categorizes the purchase and gives immediate contextual coaching ("This grocery trip was 15% above your weekly average — here's why").

14. **"Contratto Decoder":** Upload any financial document (loan contract, insurance policy, phone plan) and the AI explains it in plain Italian, highlighting hidden costs, penalty clauses, and comparison to alternatives.

15. **NEXT Advisory Board Decision Support Tool:** An internal AI tool for BTM's young Advisory Board to evaluate project proposals — the AI scores feasibility, cost, community impact, and alignment with BTM's mission.

---

### 4b. Filtered & Ranked Ideas

Evaluation criteria: (F) Feasibility for a small BCC, (A) Alignment with NEXT and BTM's mission, (P) Post-hackathon adoption potential, (C) Creative/non-obvious use of AI.

| Rank | Idea | F | A | P | C | Notes |
|------|-------|---|---|---|---|-------|
| **1** | **SENSO (current concept)** | ★★★ | ★★★★ | ★★★★ | ★★★★ | Already designed around BTM's context. Voice AI + real data + education + service funnel. The full concept is MVP-scoped correctly. Post-hackathon, BTM could pilot it with NEXT members. |
| **2** | **"Quanto Mi Costa Davvero"** | ★★★★ | ★★★★ | ★★★★ | ★★★ | Could be a standalone feature OR a simplified entry point into SENSO. Zero onboarding version (no bank data needed) makes it instantly deployable. BTM could embed it on their website. |
| **3** | **"Primo Stipendio" Simulator** | ★★★★ | ★★★★★ | ★★★★ | ★★★ | Perfectly targeted at NEXT demographic (18-30, first job). Highly educational. Doesn't require real financial data. Could be a workshop tool for NEXT events. BTM can brand it. |
| **4** | **"Contratto Decoder"** | ★★★★ | ★★★ | ★★★★ | ★★★★ | Universally useful. Builds trust with young clients. BTM could offer it as a free service — "bring us any contract, we'll help you understand it." Differentiator vs. large banks. |
| **5** | **Subscription Audit Agent** | ★★★★ | ★★★ | ★★★ | ★★★ | Practical and viral. The "your forgotten subscriptions cost €47/month" moment drives engagement. Lower alignment with banking mission per se, but strong as a lead-gen / trust-building tool. |
| **6** | **Gamified Savings Challenges** | ★★★ | ★★★★★ | ★★★★ | ★★★ | Natural fit for NEXT community. Could integrate with BTM savings accounts. Requires ongoing content/moderation but AI can generate challenges. ElevenLabs voice for daily nudges. |
| **7** | **Financial Time Machine** | ★★★ | ★★★★ | ★★★ | ★★★★ | Powerful educational tool. Makes compound interest visible. Works as a feature within SENSO rather than standalone. |
| **8** | **"Chiedi alla Banca"** | ★★★★ | ★★★★ | ★★★★★ | ★★ | Highest post-hackathon adoption potential (direct business value for BTM), but lowest creative score — it's essentially an AI chatbot for product info. Still valuable, just not "punk." |
| **9** | **AI Financial Diary** | ★★★★ | ★★★ | ★★★ | ★★★ | Privacy-first approach is appealing. Low tech barrier. But less differentiated — many budgeting apps exist. Voice check-in angle is novel. |
| **10** | **BNPL X-Ray** | ★★ | ★★★ | ★★ | ★★★★ | Great concept, but technical integration with BNPL providers is extremely hard. No APIs available. Would need to rely on CSV/screenshot parsing. Interesting as a SENSO sub-feature. |

**Recommendation for the hackathon:** Stick with SENSO as the main concept, but scope the demo around the "Quanto Mi Costa Davvero" moment — it's the highest-impact, lowest-friction demonstration. The 75-second demo flow in the CONCEPT.md is already well designed. Consider adding one "Primo Stipendio" screen as a secondary demo path to show breadth.

**Post-hackathon pitch to BTM:** Position SENSO not as a product to build, but as a *capability* that BTM embeds across touchpoints — the NEXT community workshops, the branch consultation experience, the bancabtm.it website, and eventually the mobile banking app. The voice AI and financial reasoning engine are the core; the interfaces can vary.

---

## References (consolidated)

- OECD/INFE (2023). *International Survey of Adult Financial Literacy*. https://www.oecd.org/en/publications/oecd-infe-2023-international-survey-of-adult-financial-literacy_56003a32-en.html
- Il Sole 24 Ore (Nov 2025). *Failed in debt and loans: Italy at the bottom of the ranking for financial skills*. https://en.ilsole24ore.com/art/failed-debt-and-loans-italy-fund-ranking-financial-skills-AHCIxq8B
- Il Sole 24 Ore (Nov 2025). *Financial education, where do we stand?* https://en.ilsole24ore.com/art/financial-education-where-we-stand-compared-to-italy-and-some-eu-countries-AHBb2PuD
- Museo del Risparmio (Feb 2025). *Young People and Financial Education in Italy*. https://www.museodelrisparmio.it/blog/young-people-and-financial-education-where-do-we-stand-in-italy/
- Bruegel (2024). *The state of financial knowledge in the EU*. https://www.bruegel.org/policy-brief/state-financial-knowledge-european-union
- European Commission (2025). *EU Financial Literacy Strategy*. Via https://legal.pwc.de/en/news/articles/european-commission-publishes-its-2025-financial-literacy-strategy
- Bank of Italy / Format Research (Mar 2026). *Buy Now Pay Later: Market Characteristics*. https://formatresearch.com/en/2026/03/25/buy-now-pay-later-caratteristiche-del-mercato-banca-ditalia/
- The Conservative (Nov 2025). *Europe Tightens BNPL Rules*. https://www.theconservative.online/europe-tightens-the-rules-on-buy-now-pay-later-what-the-2026-reform-means-for-consumers-and-platforms
- Oliver Wyman (Feb 2025). *Impact of CCD2 on BNPL in Europe*. https://www.oliverwyman.com/our-expertise/insights/2025/feb/impact-of-ccd2-on-buy-now-pay-later-services-in-europe.html
- NSS Magazine (Apr 2025). *Buy Now, Pay Later: Opportunity or Risk?* https://www.nssmag.com/en/lifestyle/40634/buy-now-pay-later-risks-opportunities-debt
- Motley Fool (Nov 2025). *2025 BNPL Trends Study*. https://www.fool.com/money/research/buy-now-pay-later-statistics/
- Market Data Forecast (Feb 2026). *Europe BNPL Market*. https://www.marketdataforecast.com/market-reports/europe-buy-now-pay-market
- Chargeflow (2025). *BNPL Market Statistics*. https://www.chargeflow.io/blog/buy-now-pay-later-statistics
- Banca Territori del Monviso. https://www.bancabtm.it/chi-siamo/
- Targatocn (Oct 2025). *BTM presenta NEXT*. https://www.targatocn.it/2025/10/09/leggi-notizia/argomenti/economia-7/articolo/banca-territori-del-monviso-presenta-next-la-nuova-young-community-dedicata-ai-giovani-soci-b-1.html
- Targatocn (Dec 2025). *Advisory Board NEXT*. https://www.targatocn.it/2025/12/22/leggi-notizia/argomenti/economia-7/articolo/al-via-le-candidature-per-ladvisory-board-next-btm-young-community.html
- ANSA (Oct 2025). *BTM Young Community*. https://www.ansa.it/sito/notizie/economia/risparmio_Investimenti/2025/10/26/la-banca-territori-del-monviso-crea-una-young-community_2886c41c-ca6c-4597-87dd-b5df172ed9b0.html
- Cassa Centrale Banca. *Our Roots*. https://www.cassacentrale.it/en/group/our-roots
- Kiplinger (Jan 2026). *The 60/30/10 Budgeting Method*. https://www.kiplinger.com/personal-finance/the-new-603010-budgeting-method
- Thrivent (Sep 2025). *The 75/15/10 Budget*. https://www.thrivent.com/insights/budgeting-saving/the-75-15-10-budget-pros-cons-and-who-should-use-one
- Base Wealth Management (Aug 2025). *15-65-20 Rule*. https://basewealthmanagement.com/financial-videos/can-the-15-65-20-budget-rule-boost-your-savings-fast/
- DQYDJ. *The Four Pillars of Personal Finance*. https://dqydj.com/the-four-pillars-of-personal-finance/
- GOBankingRates (Jan 2024). *4 Pillars of Personal Finance*. https://www.gobankingrates.com/money/financial-planning/pillars-of-personal-finance/
- William Bernstein (2002). *The Four Pillars of Investing*. https://www.efficientfrontier.com/t4poi/intro.htm
- Aiello & Bonanno (2016). *BCC Efficiency and Local Market Conditions*. https://www.sciencedirect.com/science/article/abs/pii/S0148619515000508
- Agostino et al. (2022). *Do cooperative banks matter for new business creation?* https://onlinelibrary.wiley.com/doi/10.1111/apce.12342
- Guilmi et al. (2025). *Management Cost Efficiency: Cooperative vs. Non-Cooperative*. https://link.springer.com/article/10.1007/s13132-025-02612-0

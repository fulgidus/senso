# Bank Connectors Research (2026-04-12)

## Hackathon: GoCardless Bank Account Data (ex-Nordigen)
- **€0**, read-only account+transaction access via PSD2
- 50+ Italian banks (Intesa, UniCredit, Fineco…)
- REST JSON API, 90-day consent refresh (PSD2 rule)
- Docs: `developer.gocardless.com/bank-account-data/`

## Post-hackathon FOSS path: adorsys/open-banking-gateway
- GitHub: `github.com/adorsys/open-banking-gateway` (⭐321, Apache-2.0)
- Java, Berlin Group XS2A/NextGenPSD2 client
- **Requires own TPP/AISP license** (Banca d'Italia regulated)
  - eIDAS certificate
  - Legal entity + compliance officer + capital requirements
  - Budget: **~€15K+**, timeline: **~6 months**
- Bank-by-bank integration maintenance needed (CBI Globe in Italy)
- Only viable if FOSS is a hard philosophical/business requirement

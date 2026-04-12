# Ingestion Sample Files

Place real export files from each institution here before implementing builtin modules.
Implementing agents MUST inspect sample files before writing FINGERPRINT patterns or extract logic.

## Folder Map

| Folder | Institution | Expected file types |
|--------|-------------|---------------------|
| `fineco_it/` | FinecoBank Italy | `.xlsx` (Portafoglio → Esporta) |
| `revolut_it/` | Revolut Italy | `.pdf`, `.csv` (Statement export) |
| `satispay_it/` | Satispay Italy | `.pdf`, `.csv` (Transaction history) |
| `paypal_it/` | PayPal Italy | `.pdf`, `.csv` (Activity download) |
| `edison_energia_it/` | Edison Energia Italy | `.pdf` (Bolletta elettricità / gas) |
| `generic_invoice_it/` | Generic Italian invoice | `.pdf` |

## Rules

- Files in this directory are **never shipped in the Docker image** (added to `.dockerignore`).
- Files here are for development reference only. **Do not commit** (added to `.gitignore`).
- At minimum, one sample file per institution per format is required before the corresponding builtin modules can be implemented.

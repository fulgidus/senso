---
created: "2026-03-31T19:25:24.480Z"
title: Replace obfuscate_email with envelope-based admin-readable encryption
area: database
files:
  - api/app/db/crypto.py
  - api/app/db/models.py
  - api/app/services/admin_service.py
  - api/app/routers/admin.py
---

## Problem

`_obfuscate_email()` (used in admin merchant mapping to show contributing users as `u****@domain.com`) is a cosmetic half-measure, not real protection. The contact email — which may differ from the login email — is sensitive identifying information and should receive the same encryption treatment as other PII columns (T2 AES-GCM at rest).

However, unlike other encrypted PII, admin users need to be able to read and act on contact emails in operational scenarios (e.g., contacting a user about a flagged merchant mapping). This creates a tension between encryption at rest and admin usability that `_obfuscate_email()` papers over badly.

## Solution

Implement admin envelope encryption for contact-class data:

1. **Encrypt contact emails at rest** the same way as other T2 columns (AES-GCM via `StringEncryptedType`), removing the `_obfuscate_email()` function entirely.

2. **Admin envelope scheme:**
   - Each admin user gets an envelope wrapping key derived from their credentials at provisioning time.
   - Contact-class data is additionally wrapped with each active admin's envelope key, so any admin can unwrap and read it.
   - When a new admin is provisioned, generate a new envelope and wrap all existing contact data with it.
   - When an admin rotates their password, re-wrap all envelopes tied to their old derived key.

3. **Admin API surface:**
   - Admin endpoints that need to display contact emails unwrap using the requesting admin's envelope.
   - Non-admin users never see contact data (not even obfuscated).

This aligns with the existing Phase 10 crypto infrastructure (`crypto.py` PBKDF2 helpers, `server_wrap_user_key`/`unwrap_user_key` pattern) and extends it with a multi-recipient envelope model.

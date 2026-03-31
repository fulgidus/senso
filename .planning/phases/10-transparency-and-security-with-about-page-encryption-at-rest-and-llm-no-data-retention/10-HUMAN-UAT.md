---
status: partial
phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
source: [10-VERIFICATION.md]
started: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Privacy badge in ChatScreen
expected: When user has strict_privacy_mode=true, a ShieldCheck badge labeled "Modalità privacy" (or "Privacy mode") is visible in the chat header area
result: [pending]

### 2. TTS disabled notice
expected: When strict_privacy_mode=true and user taps the TTS/voice button, an inline notice with ShieldOff icon appears above the input bar explaining voice is disabled; notice can be dismissed with ×
result: [pending]

### 3. About page without authentication
expected: Navigating to /about while logged out renders the PublicShell with 6 content sections (What, How, Data, AI, Safety, Legal) without redirecting to login
result: [pending]

### 4. Strict Privacy toggle API round-trip
expected: Toggling the Privacy mode switch in Settings sends PATCH /auth/me with body containing {"strict_privacy_mode": true/false} and the toggle state persists on page reload
result: [pending]

### 5. Test suite verification
expected: docker compose run --rm api uv run pytest tests/test_crypto.py tests/test_llm_noretention.py tests/test_encryption.py passes with all tests green
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

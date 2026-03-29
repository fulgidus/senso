# Deferred Items

## 2026-03-29

- Pre-existing Postgres migration warnings still appear during API test startup from legacy `chat_sessions.user_id` / `chat_messages ... cs.user_id` statements in `api/app/db/session.py`. They did not block Phase 07-01 verification, but they remain out of scope for this plan and should be cleaned up in a dedicated migration-hardening pass.

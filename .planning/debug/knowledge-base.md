# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## questionnaire-500-after-phase10 - StringEncryptedType(JSONType) returns str not dict on PostgreSQL
- **Date:** 2026-03-31
- **Error patterns:** HTTP 500, questionnaire, StringEncryptedType, JSONType, PostgreSQL, income_summary, insight_cards, coaching_insights, category_totals, ValueError, dictionary update sequence, profile, encryption
- **Root cause:** StringEncryptedType(JSONType, _server_key, AesGcmEngine) is incompatible with PostgreSQL. JSONType.process_result_value is a no-op on Postgres dialect (returns value as-is because psycopg2 pre-parses native JSON). When StringEncryptedType decrypts the ciphertext to a plain JSON string and passes it to JSONType.process_result_value with a Postgres dialect, the string is returned unchanged. All downstream dict()/list operations on these columns crash.
- **Fix:** Replace StringEncryptedType(JSONType, ...) with an EncryptedJSON TypeDecorator that wraps StringEncryptedType(Text, ...) and calls json.dumps on write, json.loads on read — bypassing the dialect-specific no-op in JSONType.
- **Files changed:** api/app/db/models.py
---


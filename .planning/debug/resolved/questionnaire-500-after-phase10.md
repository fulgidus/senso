---
status: resolved
trigger: "POST /profile/questionnaire returns HTTP 500 after Phase 10 deploy. Investigate the error, find the root cause, and fix it. The error started after Phase 10 was merged to main (which added StringEncryptedType to T2 columns in api/app/db/models.py including UserProfile JSON columns like insight_cards, coaching_insights, income_summary, category_totals). The questionnaire endpoint writes to UserProfile."
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:30:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED - StringEncryptedType(JSONType, ...) wrapping is incompatible with PostgreSQL because JSONType.process_result_value returns value as-is on Postgres dialect (psycopg2 normally pre-parses JSON). When StringEncryptedType decrypts and passes the JSON string to JSONType.process_result_value with dialect='postgresql', JSONType does `return value` (no json.loads), so the column returns a raw JSON string instead of a dict/list. Any code treating the returned value as dict/list then crashes.
test: confirmed via live postgres round-trip test - income_summary type after write+read = str, not dict
expecting: fix by replacing JSONType with a custom type or using json.JSON (sqla native) instead of JSONType as the underlying type inside StringEncryptedType
next_action: implement fix in models.py

## Symptoms

expected: POST /profile/questionnaire returns 200 and saves questionnaire answers to UserProfile
actual: POST /profile/questionnaire returns HTTP 500
errors: unknown - checking logs/code
reproduction: POST /profile/questionnaire after Phase 10 deploy
started: after Phase 10 merged to main (added StringEncryptedType to T2 columns in UserProfile)

## Evidence

- timestamp: 2026-03-31T00:10:00Z
  checked: api/app/db/models.py UserProfile column definitions
  found: income_summary, category_totals, insight_cards, coaching_insights all use StringEncryptedType(JSONType, _server_key, AesGcmEngine)
  implication: This wraps a JSONType inside StringEncryptedType; JSONType normally relies on psycopg2 to auto-parse JSON from Postgres

- timestamp: 2026-03-31T00:11:00Z
  checked: sqlalchemy_utils JSONType.process_result_value source
  found: on PostgreSQL dialect it does `return value` (no json.loads) because psycopg2 pre-parses JSON. But StringEncryptedType intercepts and passes the DECRYPTED STRING (not psycopg2-parsed object) to this method.
  implication: JSONType.process_result_value returns the raw JSON string unchanged on Postgres → column value is str not dict/list

- timestamp: 2026-03-31T00:12:00Z
  checked: live round-trip test via docker compose run
  found: income_summary type after write+read = str ("{'amount': 2000.0, ...}"), not dict. category_totals = str('{}'), insight_cards = str('[]')
  implication: Any dict() call, .get() call, list indexing, or Pydantic validation on these columns will fail

- timestamp: 2026-03-31T00:13:00Z
  checked: profile_service.py confirm_profile
  found: line 153: `income_summary = dict(profile.income_summary or {})` - when income_summary is a string like "{'amount': 2000.0, ...}", dict() tries to iterate character-by-character → ValueError
  implication: This is the 500 on confirm_profile. save_questionnaire itself succeeds (no dict() call) but sets bad data.

- timestamp: 2026-03-31T00:14:00Z
  checked: docker-compose.yml - ENCRYPTION_KEY env var
  found: ENCRYPTION_KEY is NOT passed explicitly in docker-compose.yml environment block, but IS in .env file (env_file: .env is set). .env has no ENCRYPTION_KEY entry. Falls back to default "dev-enc-key-change-me-32bytes!!!" (32 chars) - valid for AesGcmEngine.
  implication: ENCRYPTION_KEY is available at runtime. The crash is not a missing key issue, it's the JSONType+PostgreSQL dialect incompatibility.

- timestamp: 2026-03-31T00:15:00Z
  checked: StringEncryptedType.process_result_value source
  found: It calls underlying_type.process_result_value(decrypted_value, dialect). For PostgreSQL + JSONType this returns the string as-is. The fallback `elif issubclass(type_, JSONType): return json.loads(decrypted_value)` is ONLY reached when process_result_value raises AttributeError - but JSONType DOES have that method, so the fallback is never triggered.
  implication: The fix is to not use JSONType as the underlying type. Use a type that calls json.loads regardless of dialect, or add explicit JSON deserialization after decryption.

## Eliminated

- hypothesis: Missing ENCRYPTION_KEY causes crypto failure
  evidence: docker-compose has env_file: .env; default fallback key is 32 bytes which is valid for AES-256
  timestamp: 2026-03-31T00:14:00Z

- hypothesis: AesGcmEngine key length validation error
  evidence: default key "dev-enc-key-change-me-32bytes!!!" is exactly 32 chars; round-trip test succeeds
  timestamp: 2026-03-31T00:11:00Z

## Resolution

root_cause: StringEncryptedType(JSONType, _server_key, AesGcmEngine) is incompatible with PostgreSQL. JSONType.process_result_value on Postgres dialect is a no-op (returns value as-is) because psycopg2 normally pre-parses native JSON/JSONB columns into Python objects. But StringEncryptedType stores as TEXT/VARCHAR and decrypts to a plain JSON string before calling JSONType.process_result_value - so the no-op returns the raw string instead of a dict/list. Any downstream code calling dict() or list indexing on these columns crashes with ValueError.
fix: Replaced StringEncryptedType(JSONType, ...) with a new EncryptedJSON TypeDecorator in models.py. EncryptedJSON wraps StringEncryptedType(Text, ...) and explicitly calls json.dumps on write and json.loads on read, bypassing JSONType's dialect-specific no-op on PostgreSQL.
verification: Live Postgres round-trip test confirmed income_summary, category_totals, insight_cards, coaching_insights all return proper dict/list after write+read. dict() call on income_summary succeeds. All 8 profile+encryption tests pass. 245 other tests unaffected. 13 pre-existing TTS test failures confirmed pre-existed before fix.
files_changed: [api/app/db/models.py]

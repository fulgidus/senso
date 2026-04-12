# Retrospective

## v1.0 MVP (2026-04-12)

### What Went Well
- 32 phases shipped in ~3 weeks, all 132 plans executed
- Modular ingestion pipeline: adding new document types = new module, not arch changes
- Multi-provider LLM layer: survived provider outages by falling back
- E2E encryption added mid-stream without breaking existing data (EncryptedJSON transparent migration)

### What Didn't
- Phase numbering got chaotic (12.1, 12.1.1, then jump to 24-30, back to 17-23) — out-of-order execution
- Insight generation silently returning `[]` went unnoticed until user testing
- FilesTab camelCase mismatch shipped and stayed broken until manual testing caught it
- `first_name=None` hardcoded in coaching endpoints — missed during Phase 29 PII work

### Patterns to Keep
- Docker Compose as single source of truth for running/testing
- Convention-driven: CONVENTIONS.md as living doc, enforced by review
- UI error state convention (added late, should have been day 1)

### Patterns to Change
- Enforce TS strict mode earlier — `unknown` type leaks caught too late
- API type contracts should be generated or shared, not hand-maintained on both sides
- Add a "smoke test" phase after each major UI refactor

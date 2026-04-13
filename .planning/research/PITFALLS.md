# Research: Platform Refactoring Pitfalls for Domain-Specific AI Applications

## Summary
When refactoring working domain-specific AI applications (like SENSO) into generic platforms, teams face predictable failure patterns that can destroy performance, functionality, and developer ergonomics. The most dangerous pitfalls emerge from over-abstraction pressure: the "second system effect" drives teams to build overly-complex generic solutions, JSONB flexibility kills query performance without proper indexing, LLM prompt abstraction measurably degrades task-specific quality, and plugin architectures create "configuration hell." Evidence shows that task-specific optimizations often outperform generic templates—maintaining these during platform abstraction is critical.

## Findings

1. **Second System Effect in Platform Abstraction** — The successful first system (SENSO) creates overconfidence leading to over-engineered generic replacements. Teams replace simple, working domain-specific code with complex abstractions that nobody asked for. [ACM Queue: Lessons learned from building a second-generation system](https://queue.acm.org/detail.cfm?id=3799736)

2. **JSONB Performance Degradation** — Generic schema flexibility through PostgreSQL JSONB columns causes 15-20x query slowdowns without proper GIN indexing. Moving from typed columns to flexible schemas kills performance unless expression indexes are added for frequently-queried paths. [PostgreSQL Performance in 2026](https://releaserun.com/postgresql-performance-in-2026-jsonb-full-text-search-and-query-optimization/)

3. **LLM Prompt Quality Loss Through Abstraction** — Generic "improved" prompt templates measurably degrade task-specific performance: extraction pass rates drop 10%, RAG compliance drops 13%, while instruction-following improves 13%. Task-specific prompts outperform generic templates on structured tasks. [When "Better" Prompts Hurt: Evaluation-Driven Iteration for LLM Applications](https://arxiv.org/html/2601.22025v1)

4. **SDUI Performance and Complexity Overhead** — Server-driven UI introduces network latency on every interface change, complex debugging across distributed systems, limited offline support, and reduced client flexibility for custom animations. Backend complexity increases dramatically as UI state moves server-side. [Server-Driven UI Best Practices and Common Pitfalls](https://nativeblocks.io/blog/best-practices-and-common-pitfalls/)

5. **Plugin Architecture "Configuration Hell"** — Pure plugin systems face "plugin hell": concurrent version conflicts, complex dependency resolution, overwhelming installation choices (1000+ plugins), and security vulnerabilities from untrusted third-party code. Installation becomes a nightmare without careful version management. [On Plug-ins and Extensible Architectures](https://queue.acm.org/detail.cfm?id=1053345)

6. **Auto-Generated API Type Safety Loss** — Code generation round-trips fail to preserve schema fidelity: examples get dropped, allOf structures flatten incorrectly, and generated types become unstable (Object124 naming). Teams lose debugging clarity and type safety when APIs auto-generate from generic schemas. [OpenAPI's Broken Tooling: Roundtrip Fidelity Failure](https://specmatic.io/updates/openapis-broken-tooling-roundtrip-fidelity-failure-with-codegen-and-docgen/)

## Sources

### Kept Sources
- **ACM Queue: Second System Effect** (queue.acm.org) — Direct evidence from LMS platform refactoring with concrete mitigation strategies
- **PostgreSQL Performance 2026** (releaserun.com) — Current best practices for JSONB indexing with quantified performance impacts  
- **LLM Prompt Degradation Study** (arxiv.org) — Reproducible experimental evidence that generic prompts harm task-specific performance
- **SDUI Best Practices** (nativeblocks.io) — Real-world pitfalls from production SDUI implementations
- **Eclipse Plugin Architecture Analysis** (queue.acm.org) — 20-year perspective on plugin system failure modes from major platform
- **OpenAPI Tooling Analysis** (specmatic.io) — Concrete examples of code generation fidelity failures

### Dropped Sources
- Blog posts without quantified evidence — excluded for lack of measurable data
- Vendor marketing materials — excluded for obvious bias
- Generic "microservices pitfalls" content — excluded for insufficient domain specificity

## Gaps

**Build Phase Timing**: Sources don't clearly specify when each pitfall should be addressed during platform development phases. Research needed on whether performance optimization should happen during MVP vs. post-MVP phases.

**Domain Transfer Evidence**: Limited research on which abstractions successfully transfer between domains (financial AI → healthcare AI) vs. those that should remain domain-specific.

**Rollback Strategies**: Insufficient guidance on how to revert from over-abstracted platforms back to working domain-specific implementations when platform efforts fail.

## Platform Development Anti-Pattern Analysis

### 1. Second System Effect
**Warning Signs**: 
- Teams saying "now we know better" and rebuilding from scratch
- Scope creep during platform abstraction (adding features original system didn't need)  
- Extended timelines for "architectural elegance"
- MVP mentality abandoned for comprehensive platform building

**Prevention Strategy**: 
- Start with MVP platform targeting narrow use cases
- Keep original system running in parallel for 6+ months  
- Look for simple abstractions that encompass old + new rather than extending features
- Limit initial abstraction implementation scope (plan but don't fully execute)

**Build Phase**: **Architecture Phase** — Address during initial platform design before any code refactoring begins.

### 2. JSONB Performance Traps  
**Warning Signs**:
- Query times increase 10-15x after moving to flexible schemas
- Sequential scans on million+ row tables with JSONB filters
- Missing GIN indexes on frequently-queried JSON paths
- 15,420 buffer reads for simple lookups (should be <10)

**Prevention Strategy**:
- Add GIN indexes immediately: `CREATE INDEX USING GIN (jsonb_column jsonb_path_ops)`
- Create expression indexes for hot paths: `CREATE INDEX ON table ((column->>'key'))`  
- Use partial indexes for recent data: `WHERE created_at > NOW() - INTERVAL '90 days'`
- Test query plans with `EXPLAIN (ANALYZE, BUFFERS)` before migration

**Build Phase**: **Database Migration Phase** — Address during schema abstraction, before performance degrades in production.

### 3. LLM Prompt Degradation
**Warning Signs**:
- Generic prompt templates perform worse than original domain-specific prompts
- Extraction accuracy drops below 95% after abstraction  
- RAG citation compliance falls below 90%
- Format compliance errors increase with "helpful" generic wrappers

**Prevention Strategy**:
- Maintain task-specific evaluation suites (20-50 test cases each)
- Test prompt changes against domain-specific metrics, not generic ones
- Keep domain-specific prompts as fallbacks during abstraction
- Use evaluation-driven iteration: measure before/after for each prompt change

**Build Phase**: **LLM Abstraction Phase** — Address during Domain Manifest development when prompts get templated.

### 4. SDUI Performance & Debugging
**Warning Signs**:
- UI changes require network requests (latency increase)
- Complex error tracing across server/client boundaries
- Offline functionality breaks
- Custom animations/interactions become impossible to implement

**Prevention Strategy**:
- Start with simple components (banners/flags) before complex forms
- Implement aggressive caching with content checksums
- Plan offline fallback screens for all critical user flows  
- Keep escape hatches for native platform-specific components

**Build Phase**: **UI Abstraction Phase** — Address during SDUI implementation before rolling out to complex screens.

### 5. Plugin Architecture Hell
**Warning Signs**:
- >100 plugins installed (complexity explosion point)
- Version conflict errors during updates  
- Installation requires expert knowledge to configure correctly
- Security vulnerabilities from untrusted plugin sources
- Duplicate functionality across plugin boundaries

**Prevention Strategy**:
- Design for finite, curated plugin ecosystem rather than unlimited expansion
- Implement strict plugin versioning with automated conflict resolution
- Group plugins into "feature bundles" to reduce installation complexity
- Require plugin security review process
- Limit concurrent plugin versions (latest wins with exceptions for libraries)

**Build Phase**: **Plugin System Phase** — Address during initial plugin architecture design, before opening to third-party developers.

### 6. Auto-Generated API Type Safety Loss  
**Warning Signs**:
- Generated types have unstable names (Object124, Object125)
- Round-trip code generation loses schema information
- Examples and descriptions disappear from generated specs
- allOf/oneOf structures flatten incorrectly
- Debugging requires tracing through generated code layers

**Prevention Strategy**:  
- Pin schema versions and validate round-trip fidelity in CI
- Name complex types explicitly in schemas (avoid anonymous objects)
- Maintain hand-written integration tests that verify generated APIs
- Use JSON Schema validation at runtime to catch generation errors
- Keep escape hatches for hand-written critical API endpoints

**Build Phase**: **API Generation Phase** — Address during Domain Manifest schema design, before auto-generation goes live.

## Build Phase Recommendation Summary

| Pitfall Category | Critical Phase | Risk Level | Mitigation Cost |
|-----------------|----------------|------------|-----------------|
| Second System Effect | Architecture | EXTREME | Low (process change) |
| JSONB Performance | Database Migration | HIGH | Medium (indexing strategy) |  
| LLM Prompt Quality | LLM Abstraction | HIGH | Medium (evaluation framework) |
| SDUI Complexity | UI Abstraction | MEDIUM | High (caching architecture) |
| Plugin Hell | Plugin System | MEDIUM | Medium (curation process) |
| API Type Safety | API Generation | LOW | Low (schema validation) |

**Critical Path**: Address Second System Effect first (architecture phase) as it influences all other decisions. JSONB and LLM prompt issues have highest technical risk and should be tackled early with comprehensive testing frameworks.
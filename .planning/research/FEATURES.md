# Research: Domain-Agnostic AI Coaching Platform Features

## Summary
Domain-agnostic AI coaching platforms require three critical architectural layers: an orchestration layer for workflow management, a composable intelligence layer for pluggable AI capabilities, and a server-driven UI layer for dynamic domain rendering. The differentiation lies in governance sophistication, true multi-model orchestration, and schema-driven automation.

## Findings

### 1. Multi-Domain Knowledge Management

**1.1 Enterprise Search with RAG Integration** — All major platforms (Rasa, Botpress, Voiceflow) implement vector-based knowledge retrieval with external data source integration. [Rasa Enterprise Search](https://www.rasa.com/docs/pro/customize/enterprise-search/)

**1.2 Knowledge Base Segmentation** — Domain-specific knowledge isolation through namespaces, scopes, or tenant boundaries. Voiceflow supports 190+ integrations with domain-specific data sources. [Voiceflow Knowledge Base](https://www.voiceflow.com/features/knowledge-base-generative-ai)

**1.3 Schema Registry Pattern** — Centralized type definitions and validation rules across domains. Enables consistent data models while allowing domain-specific extensions.

**1.4 Contextual Knowledge Injection** — Domain context passed to AI models rather than global knowledge flooding. Cisco's enterprise AI uses 8,000+ domain-specific acronym definitions. [Cisco Enterprise AI](https://blogs.cisco.com/ai/non-obvious-patterns-in-building-enterprise-ai-assistants)

**1.5 Multi-Modal Knowledge Sources** — Support for structured data, documents, APIs, and real-time feeds as knowledge inputs with unified querying interfaces.

### 2. Schema-Driven API Generation

**2.1 Auto-Generated CRUD Endpoints** — Prisma generators create complete FastAPI/Express endpoints from database schemas. Zero boilerplate for standard operations. [Prisma Express Generator](https://github.com/multipliedtwice/prisma-generator-express)

**2.2 Type-Safe Client Generation** — GraphQL CodeGen and OpenAPI tools auto-generate type-safe client libraries. Changes in schema automatically propagate to client types. [RTK Query CodeGen](https://redux-toolkit.js.org/rtk-query/usage/code-generation)

**2.3 Documentation Auto-Generation** — OpenAPI specs generated from schema definitions with automatic validation rules. FastSchema uses Ogen for spec generation. [FastSchema OpenAPI](https://fastschema.com/docs/framework/resource/openapi-spec.html)

**2.4 Validation Layer Generation** — Zod/Pydantic validators auto-generated from schemas. Runtime validation matches compile-time types without manual synchronization.

**2.5 Migration and Versioning Automation** — Schema changes trigger automated migration scripts and backward-compatible API versioning.

### 3. Pluggable AI Platform Architecture

**3.1 Three-Layer Architecture (Orchestration/Intelligence/Experience)** — Bain & Company identifies this as the standard pattern for agentic AI platforms. Separation enables independent evolution of each layer. [Bain Agentic AI](https://www.bain.com/insights/the-three-layers-of-an-agentic-ai-platform/)

**3.2 Model-Agnostic Intelligence Layer** — Standardized AI interfaces by capability (classification, extraction, generation) rather than by provider. Enables hot-swapping of AI models without workflow changes. [Kinetic Composable AI](https://www.kineticdata.com/blog/composable-ai-architecture-how-to-build-modular-ai-systems-that-you-actually-control)

**3.3 Plugin/Extension System** — Dynamic capability loading through standardized interfaces. Tools, skills, and integrations deployed independently of core platform. [Zylos Plugin Architecture](https://zylos.ai/research/2026-02-21-ai-agent-plugin-extension-architecture)

**3.4 Orchestration-First Design** — Workflow logic, governance, and context management handled by orchestration layer, not embedded in AI models. Critical for enterprise deployment.

**3.5 Multi-Model Coordination** — Ability to route different tasks to optimal models based on cost, accuracy, latency, and compliance requirements within single workflows.

### 4. Server-Driven UI (SDUI) Patterns

**4.1 Component Registry with Type Safety** — Airbnb's Ghost Platform uses SectionComponentType enum to map data models to UI components. Type-safe rendering across platforms. [Airbnb Ghost Platform](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)

**4.2 Layout Engine with Breakpoint Support** — ILayout interface with responsive rendering. Supports FormFactor-specific layouts (compact/wide) for cross-platform consistency.

**4.3 Action Definition in Schema** — IAction interface defines user interaction handlers in server response. Actions include navigation, API calls, and custom business logic.

**4.4 Nested Component Composition** — Components can contain other components. Enables complex UI composition from simple building blocks.

**4.5 Version Management and Rollback** — Schema versioning enables A/B testing, gradual rollouts, and instant rollbacks of UI changes without client updates.

**4.6 Cross-Platform Rendering** — Single schema renders to native iOS (Swift), Android (Kotlin), and Web (TypeScript) components. DivKit demonstrates this pattern. [DivKit SDUI](https://divkit.tech/)

### 5. Domain-Configurable Safety/Behavior Patterns

**5.1 Dynamic Guardrail Models** — DynaGuard enables user-defined policies for domain-specific safety evaluation. Moves beyond static harm categories. [DynaGuard](https://taruschirag.github.io/DynaGuard/)

**5.2 Controllable Safety Alignment** — CoSA framework adapts models to diverse safety requirements without retraining. Domain-specific safety configs applied at runtime.

**5.3 Rule-Based Behavior Modulation** — OpenAI's Rule Based Rewards uses collections of rules for desired/undesired behaviors. Domain experts define rules without ML expertise.

**5.4 Multi-Domain Policy Management** — POLY-GUARD dataset covers eight safety-critical domains (finance, law, healthcare) with domain-specific guidelines.

**5.5 Contextual Persona Boundaries** — Safety and behavior rules tied to conversation context, user roles, and domain-specific compliance requirements.

## Feature Classification

### Table Stakes (Required for Market Entry)
- **Basic RAG/Knowledge Retrieval** (Low Complexity) — Every platform needs document search and basic AI integration
- **API Auto-Generation** (Medium Complexity) — Standard CRUD generation from schemas is expected
- **Component-Based UI** (Medium Complexity) — Modular UI composition is industry standard
- **Multi-Model Support** (Medium Complexity) — Platform lock-in to single AI provider is unacceptable
- **Audit Logging** (Low Complexity) — Basic tracking of AI decisions and user actions

### Differentiators (Competitive Advantages)
- **True Multi-Model Orchestration** (High Complexity) — Routing tasks to optimal models within single workflows based on cost/accuracy/compliance
- **Schema-Driven Domain Manifests** (High Complexity) — Complete domain definition through declarative schemas (data models + UI + behavior + safety rules)
- **Dynamic Safety Policy Engine** (Very High Complexity) — Runtime adaptation of AI behavior based on domain-specific safety requirements without model retraining
- **Cross-Platform SDUI with Actions** (High Complexity) — Server-defined UI that includes interaction handlers, not just static rendering
- **Governance-First Architecture** (High Complexity) — Human-in-the-loop, compliance tracking, and exception handling as platform capabilities, not bolt-ons
- **Real-Time Schema Evolution** (Very High Complexity) — Hot-swapping of domain definitions, UI schemas, and AI models without downtime

### Anti-Features (Avoid These Patterns)
- **AI Model Lock-In** — Hardcoding specific AI provider APIs breaks composability
- **Monolithic Domain Embedding** — Baking domain logic into core platform code prevents extensibility
- **Client-Side Schema Coupling** — Requiring client updates for domain changes breaks the SDUI value proposition
- **Static Safety Policies** — One-size-fits-all safety that can't adapt to domain-specific requirements
- **Vendor-Controlled Governance** — Audit and compliance capabilities that depend on vendor roadmaps

## Sources

**Kept:**
- Airbnb Ghost Platform (https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5) — Comprehensive SDUI implementation with cross-platform rendering, action handling, and component registry patterns
- Kinetic Composable AI (https://www.kineticdata.com/blog/composable-ai-architecture-how-to-build-modular-ai-systems-that-you-actually-control) — Three-layer architecture pattern and orchestration-first design principles for enterprise AI
- Rasa Enterprise Search (https://www.rasa.com/docs/pro/customize/enterprise-search/) — RAG implementation for multi-domain knowledge management with vector store integration
- DynaGuard (https://taruschirag.github.io/DynaGuard/) — Dynamic guardrail models with user-defined policies for domain-specific safety
- Zylos Plugin Architecture (https://zylos.ai/research/2026-02-21-ai-agent-plugin-extension-architecture) — Comprehensive analysis of AI agent extension patterns and modular capability loading
- DivKit SDUI (https://divkit.tech/) — Open-source cross-platform server-driven UI framework with JSON schema approach

**Dropped:**
- Generic AI platform comparisons — Focused on marketing features rather than architectural patterns
- Outdated chatbot frameworks — Legacy approaches that predate modern LLM capabilities
- Academic papers without implementation details — Theoretical work without practical application patterns

## Gaps

**Schema Evolution Patterns** — Limited information on how platforms handle breaking changes to domain schemas in production. Need research on zero-downtime migration strategies.

**Performance Characteristics** — Insufficient data on latency and throughput implications of composable vs monolithic architectures at scale.

**Domain Migration Tooling** — No clear patterns for migrating existing domain-specific AI systems into composable architectures without business disruption.

## Next Steps

1. **Prototype Schema-Driven Domain Manifest** — Define SENSO's "Chest" concept as comprehensive domain schema including data models, UI components, AI personas, and safety rules
2. **Evaluate SDUI Frameworks** — Technical deep-dive on DivKit vs custom implementation for SENSO's cross-platform needs
3. **Design Composable AI Layer** — Map SENSO's coaching, extraction, and analysis capabilities to pluggable AI interfaces
4. **Research Schema Migration Patterns** — How to evolve domain manifests safely in production
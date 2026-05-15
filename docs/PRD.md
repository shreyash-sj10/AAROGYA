# Product Requirements Document (PRD)

**Product:** AAROGYA (Ayurveda-informed, contract-first meal intelligence)  
**Document version:** 1.1  
**Last updated:** 2026-05-14  
**Owner:** Product / Engineering (major project)

---

## 1. Exe   cutive Summary

AAROGYA is a **deterministic, contract-first meal recommendation and planning system** that blends **Ayurveda-informed constraints** (e.g., prakriti, digestibility, dosha-aware rules) with **modern nutrition scoring**, optimization, and optional **assistive AI** (RAG, explanation, symptom parsing). The core promise: **safe, explainable, repeatable recommendations** where ML **augments** but does **not** override hard safety and schema-valid decisions.

**Primary delivery surfaces:** REST API (Node/Express backend), React (Vite) web app (onboarding, planner, dashboard, knowledge assistant), Python **FastAPI** “controlled AI” service (profile, explain, RAG, prakriti, parse), PostgreSQL persistence, optional Redis.

---

## 2. Purpose & Goals

### 2.1 Problem Statement

Users who want Ayurveda-aligned eating guidance often receive either (a) generic nutrition advice without constitutional context, or (b) opaque LLM suggestions that are hard to trust, reproduce, or validate against allergies and clinical constraints.

### 2.2 Product Goals

| Goal | Description |
|------|-------------|
| **Safety-first** | Hard filters for allergies, incompatible foods, and high-priority rules; **P0 rules are never relaxed** and **every reliability output is re-checked against P0** before return. |
| **Determinism** | Same canonical input produces the same selection path and traceable outcomes (stable tie-breaks, bounded scores). |
| **Explainability** | Every recommendation is accompanied by trace/rule/score context suitable for audit and user education. |
| **Contract governance** | Versioned request/response schemas at API and module boundaries; breaking changes require new contract versions. |
| **Graceful AI** | AI/RAG/prakriti inputs are optional, schema-validated, and confidence-gated; deterministic pipeline completes without AI. |

### 2.3 Business Value

- Differentiation in **regulated-adjacent wellness** through traceability and deterministic core.  
- Lower operational risk vs. “LLM-only” meal apps.  
- Foundation for B2B (clinics, coaches) via **exportable traces**, weekly plans, and adherence telemetry.

### 2.4 Non-Goals (Product)

- Replacing licensed medical diagnosis or treatment.  
- Unbounded free-text in controlled enums / vocab without normalization.  
- Non-deterministic scoring or random meal selection in the core engine.

---

## 3. Target Users & Personas

### 3.1 Persona A — “Constitution-Curious Planner” (B2C)

- Wants weekly/daily plans aligned with goals and Ayurvedic constitution (prakriti).  
- Needs clear **why this meal** explanations and ability to adjust constraints.

### 3.2 Persona B — “Constraint-Heavy User”

- Allergies, vegetarian/vegan, medical flags; needs **guaranteed reject** behavior and visible confidence when the engine relaxes non-P0 tiers.

### 3.3 Persona C — “Engineering / Integrator” (B2B-lite)

- Consumes **DecisionRequest_v1 / DecisionResponse_v1**, health checks, and metrics; requires stable contracts and idempotency semantics.

---

## 4. User Journeys & Flows (High Level)

1. **Onboard** → capture goals, health/constraints, prakriti questionnaire → persist `UserContext`.  
2. **Plan** → request daily/weekly plan → pipeline runs template → candidates → constraints → scoring → diversity → optimizer → reliability → response + trace.  
3. **Adapt** → feedback and adherence update preferences/history; diversity and scoring react deterministically.  
4. **Learn** → knowledge/RAG assistant answers within controlled backend routing (no direct client→raw LLM for decision fields).  
5. **Audit** → trace view for engineering or power users (transparency).

*(UI routes in app: onboarding, planner, dashboard, knowledge, login/signup, trace.)*

---

## 5. Features & Functional Requirements

### 5.1 Core Planning Engine (P0)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| F-01 | Accept and validate **DecisionRequest_v1** | Invalid requests rejected with **ErrorResponse_v1**; no partial silent fixes. |
| F-02 | Deterministic pipeline | Documented stages; tie-break order fixed; property tests pass for determinism suites. |
| F-03 | Constraint engine | Rule priorities: reject/penalize; **P0 never excluded** from evaluation; post-pass **P0 compliance** asserted on emitted meal plans. |
| F-04 | Scoring | Bounded scores; components documented in trace/confidence model. |
| F-05 | Diversity | Repetition penalties applied deterministically from history/templates. |
| F-06 | Optimizer | Beam-first with deterministic greedy fallback; same input → same output. |
| F-07 | Reliability | **Implemented ladder:** strict pass (level 0), then recovery passes **level 1** (P3 excluded), **level 2** (P2+P3 excluded), **level 3** (P1+P2+P3 excluded); then safe fallback. **P0 is never excluded** from the active rule set; **P1 may be excluded only at level 3** when lower tiers still yield no plan. **P0 output compliance** is verified after every pass. |
| F-08 | Explanation | Deterministic narrative; optional AI text does not alter selection. |

### 5.2 Contracts & API (P0)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| C-01 | Immutable contract versions | `_v2` only for breaking changes; schema_version populated. |
| C-02 | Trace integrity | Trace stages align with pipeline; validators enforce structure. |
| C-03 | Health & metrics | Health endpoint reflects DB/LLM degradation accurately. |

### 5.3 Persistence & Identity (P0–P1)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| D-01 | PostgreSQL | **Dual persistence (as implemented):** Prisma models for **users**, **user context** (JSON), **meal history**, **weekly adherence**; **raw SQL–managed catalog tables** for foods, rules, templates, plans, and related runtime data (`food_catalog`, `rule_catalog`, `meal_templates`, `weekly_plans`, etc.). Both must be migrated and populated for full production. |
| D-02 | Auth | JWT/bcrypt-based signup/login; protected routes for user data. |
| D-03 | Degraded mode | Server may start without `DATABASE_URL` when `REQUIRE_DB` is not `true` (catalog/history features degraded). **`JWT_SECRET` is required** for any process that loads auth routes (signup/login); document in runbooks. |

### 5.4 Assistive AI Service (P1)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| A-01 | FastAPI service | `/health` reports LLM check status; routers for profile, explain, feedback, RAG, prakriti, parse. |
| A-02 | Boundary | AI cannot inject decision fields (`meal`, `selection`); invalid AI output discarded. |
| A-03 | Timeouts/retries | Configurable via env; failures do not block deterministic completion. |

### 5.5 Frontend (P1)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| U-01 | No direct AI endpoints for decisions | Build-time check passes (`check-no-direct-ai-endpoints`). |
| U-02 | Core flows | Onboarding, planner, dashboard render; errors surfaced to user. |
| U-03 | Accessibility baseline | Focus order, labels on primary controls (incremental OK for MVP). |

### 5.6 Observability (P1)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| O-01 | Logging | Trace/LLM log hooks present for debugging and KPI extraction. |
| O-02 | Metrics hooks | KPI module available for dashboard/telemetry endpoints where implemented. |

### 5.7 Recipe / food model (current vs target)

**Current implementation (v1.0 — hybrid, honest scope):**  
- **Candidates** may be sourced via recipe validation and `RecipeAggregate_v1` helpers (`getValidRecipes`, aggregate compute/cache).  
- **Scoring, diversity, optimizer, and reliability** remain **food-shaped** entities (meal slots built from food records, including `recipe_id` linkage where present).  
- This is intentional partial integration: **not** yet “recipe aggregate is the sole scoring input.”

**Deferred target (v1.1+ — R-01 / R-02):**  
- `RecipeAggregate_v1` **drives** nutrition and constraint inputs end-to-end; optimizer consumes recipe-level combinations; tests and contracts updated; **zero P0 regression** vs v1.0 golden sets.

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| R-01 | Recipe-first model (v1.1+) | `RecipeAggregate_v1` drives candidates **and** primary scoring inputs; aggregate persistence as required by deployment. |
| R-02 | Migration from Food unit (v1.1+) | Pipeline and E2E tests updated; P0 safety suite still green. |

---

## 6. Scope & Constraints

### 6.1 In Scope (Current Program)

- Monorepo: `apps/backend`, `apps/frontend`, `apps/ai-service`.  
- Contract-first JSON APIs; AJV validation; replay/reliability testing.  
- Prisma + raw SQL paths as implemented; Redis optional.

### 6.2 Out of Scope (This Release)

- Full clinical compliance (HIPAA/GDPR formal DPA) unless separately specified.  
- Mobile native apps (web-first).  
- Paid billing/subscription infrastructure.

### 6.3 Technical Constraints

- Node 18+ (CI on Node 20), Python 3 for AI service.  
- PostgreSQL required for “full” production health.  
- No nondeterministic randomness in core scoring/selection.

---

## 7. Success Metrics (KPIs)

| Metric | Definition | Target (indicative) |
|--------|------------|---------------------|
| **Plan success rate** | % requests returning valid `DecisionResponse_v1` without error | ≥ 98% on golden fixtures |
| **P0 violation rate** | Meals violating P0 rules post-validation | **0** |
| **Determinism** | Same request hash → identical meal set | 100% on determinism test suite |
| **Latency p95** | End-to-end plan API | TBD by environment; track & SLO once baselined |
| **AI attach rate** | % sessions where AI explanation attached without failure | Monitor; not blocking |
| **User adherence** | Weekly adherence score trend | Positive delta over 4 weeks (pilot) |

---

## 8. Assumptions & Dependencies

| Assumption | Impact if wrong |
|------------|-----------------|
| Food/recipe catalog quality and coverage | Plans may repeat or hit fallback often |
| Stable LLM provider for AI service | Degraded mode more frequent |
| Single-region deployment | Latency and failover patterns differ |
| Users accept wellness disclaimer | Legal/comms load |

**Dependencies:** PostgreSQL, optional Redis, OpenAI/compatible LLM for AI service, CI (GitHub Actions), deployment targets (e.g. Render URLs in example env).

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Contract drift vs. code | CI contract tests; schema loader single source |
| Over-reliance on AI | Hard boundary + build-time frontend guard |
| Data sparsity in catalog | Reliability ladder + explicit low-confidence signaling |
| Migration Food → Recipe | Feature flag + parallel validation period |

---

## 10. Release Criteria (Definition of Done — “Hardened MVP”)

- [ ] CI green: `lint`, `build`, `test:all` and **`test:extended`** at repo root (extended tier covers contracts, P0, determinism, and selected API tests).  
- [ ] Documented runbooks: [docs/RUNBOOK_LOCAL.md](RUNBOOK_LOCAL.md) (local backend, frontend, optional AI service, DB migrations, CI parity commands).  
- [ ] `REQUIRE_DB=true` path validated in staging.  
- [ ] Security: auth flows reviewed; secrets only via env.  
- [ ] Golden-path demo: onboard → weekly plan → trace visible.  
- [ ] Roadmap 3.1 either **shipped behind flag** or **explicitly deferred** with dated follow-up.

---

## 11. Glossary

- **Prakriti:** Ayurvedic constitution typing used as soft/hard constraints per rule catalog.  
- **Trace_v1:** Audit trail of pipeline stages and rule/score contributions.  
- **RecipeAggregate_v1:** Target first-class unit for nutrition + constraint evaluation (roadmap).  
- **P0 / P1 / P2 / P3:** Constraint priority tiers for the reliability ladder. **P0** is always active and output-validated; **P3** drops first, then **P2+P3**, then **P1+P2+P3** only at the deepest recovery level before fallback.

---

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-14 | Engineering | Initial PRD from codebase and internal docs |
| 1.1 | 2026-05-14 | Engineering | Aligned F-07/P1 relaxation and P0 semantics with runtime; dual persistence; hybrid recipe/food scope; CI release criteria |

---

*This PRD describes **what** the system must do; implementation details live in `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/ROADMAP.md`, local operations in `docs/RUNBOOK_LOCAL.md`, and the **SDE flagship execution checklist** in `docs/MASTER_EXECUTION_PLAN.md`.*

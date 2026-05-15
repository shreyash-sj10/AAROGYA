# AAROGYA — Master execution plan (SDE flagship track)

**Purpose:** Turn AAROGYA into a **placement-grade, backend-heavy systems project** — not a feature-chasing startup clone.

**Principles:** deterministic core, contract-first boundaries, provable safety, traceable execution, failure-aware design, operational honesty.

**Companion docs:** [PRD.md](PRD.md) (what), [ARCHITECTURE.md](ARCHITECTURE.md) (how implemented), [CONTRACTS.md](CONTRACTS.md), [RUNBOOK_LOCAL.md](RUNBOOK_LOCAL.md) (local ops), [TESTS_INVENTORY.md](TESTS_INVENTORY.md) (CI vs manual tests), [DETERMINISM_REPORT.md](DETERMINISM_REPORT.md) (Phase 1.1), [ROADMAP.md](ROADMAP.md) (recipe 3.1 technical order).

---

## Current repo snapshot (as of this plan)

| Area | Status |
|------|--------|
| Deterministic pipeline + reliability ladder | Implemented |
| Contract validators + trace stage checks | Implemented |
| CI: `npm run verify` (= lint, build, `test:all`, `test:extended`, **`test:phase1`**, `golden-path-smoke`) | Implemented |
| Backend ESLint | Implemented |
| Local runbook | [RUNBOOK_LOCAL.md](RUNBOOK_LOCAL.md) |
| Env examples | `apps/backend/.env.example`, `apps/frontend/.env.example` |
| Prisma boot | **`postinstall` → `prisma generate`** (see `apps/backend/package.json`) |
| `/health` vs DB-down + planner fallback | **Aligned** — `/health` returns **503 + HealthResponse_v1** with `checks.db.ok: false` when DB is unreachable (no **500 HEALTH_FAILED** for probe failures) |
| `npm run dev` + Docker infra | **Root `npm run dev`** runs FE+BE; **`docker compose`** provides Postgres+Redis (see Phase 0.3) |
| Determinism / P0 CI directories + `test:phase1` | **Implemented** — see [TESTS_INVENTORY.md](TESTS_INVENTORY.md), [DETERMINISM_REPORT.md](DETERMINISM_REPORT.md) |

---

## PHASE 0 — Project stabilization (2–4 days)

**Goal:** Remove fragility; **fresh clone + documented env = boot**.

### 0.1 Environment + boot

- [x] `prisma generate` on install (`postinstall` in `apps/backend`).
- [x] `.env.example` files (backend + frontend).
- [x] Redact `[Startup] DATABASE_URL=...` full-string logging (log configured host only, or `missing`).
- [x] **`/health`:** on DB check failure, return **503 + HealthResponse_v1** with `checks.db.ok: false` (not **500 HEALTH_FAILED** for probe failures).
- [x] Document: `REQUIRE_DB=true` = strict prod (no silent JSON catalogs) — see `apps/backend/.env.example`.

### 0.2 Runbooks

- [x] [RUNBOOK_LOCAL.md](RUNBOOK_LOCAL.md)
- [x] [DEPLOYMENT.md](DEPLOYMENT.md) (checklist skeleton)
- [x] [ARCHITECTURE.md](ARCHITECTURE.md) (maintain; do not fork second arch doc)

### 0.3 One-command local boot

- [x] Option A: **`docker compose`** — `postgres` + `redis` ([docker-compose.yml](../docker-compose.yml)); run **BE/FE on host** via `npm run dev` (avoids heavy Node-in-Docker installs). Optional AI: local `uvicorn` (see runbook).
- [x] Option B: root **`npm run dev`** using **`concurrently`** — backend + frontend + printed reminder ([scripts/print-dev-hint.js](../scripts/print-dev-hint.js)).
- [x] **`Makefile`** — `make dev` / `make up` / `make down` (Unix / Git Bash).

### 0.4 Repo hygiene

- [x] Inventory `apps/backend/tests/**` — [TESTS_INVENTORY.md](TESTS_INVENTORY.md); dead scratch **`tests/verifyPlan.js`** removed.
- [x] Align `package.json` scripts: no references to deleted tests (spot-check + inventory).
- [x] **`npm run verify`** at repo root and `apps/backend` = lint + build + test:all + test:extended + golden-path-smoke.

**Phase 0 exit criteria:** New teammate: `npm ci` → `prisma generate` implicit → **`npm run dev`** (or runbook per-service) → **`/plan` 200** on sample body; **`docker compose up -d`** when using Postgres/Redis; **`/health`** meaningful under DB down.

---

## PHASE 1 — Contract + safety hardening (1–2 weeks) — *highest leverage*

**Goal:** **Provable** trust.

### 1.1 Determinism suite

- [x] Directory `apps/backend/tests/determinism/` + golden harness ([testGoldenFixtureDeterminism.js](../apps/backend/tests/determinism/testGoldenFixtureDeterminism.js)).
- [x] Golden fixtures: stable input → same `meal_plan` + `trace` hash ([DETERMINISM_REPORT.md](DETERMINISM_REPORT.md)).
- [x] Wired into CI via **`npm run test:phase1`** → `scripts/run-determinism-ci.js` (included in root **`npm run verify`**).
- [x] Artifact: **[DETERMINISM_REPORT.md](DETERMINISM_REPORT.md)** (human-readable; CI regenerates proof by running the suite).

### 1.2 P0 safety suite

- [x] Directory `apps/backend/tests/p0/` + AI forbidden-field boundary test.
- [x] Fuzz-style boundary: malicious `aiProfile` / allergy / dietary / fallback P0 trace metadata (see `scripts/run-p0-ci.js`).
- [x] Assert P0 catalog + enforcement + fallback safety via existing + new tests in CI (`test:phase1`).

### 1.3 Startup integrity

- [x] Canonical rules + rule-schema startup checks in **`run-startup-contracts-ci.js`** (shared with Phase 1.4 entrypoint).

### 1.4 Schema governance

- [x] Contract smoke: `tests/startup/testContractSchemaSmoke.js` (minimal golden JSON vs AJV) in CI; full orchestrator vs `DecisionResponse_v1` remains **`tests/testResponseContracts.js`** (manual until output is schema-locked).
- [x] Backward-compat policy remains in [PRD.md](PRD.md) (`_v2` only for breaking changes).

**Phase 1 exit criteria:** **Done** — `npm run verify` fails the build if determinism or P0 / startup-contract suites regress.

---

## PHASE 2 — Trace + reliability UX (1 week)

**Goal:** Portfolio **differentiator** — *see* the engine.

- [ ] **Trace explorer** UI: request → candidates → constraints → scores → optimizer → reliability → output.
- [ ] Show: removed candidates, rule firings, score breakdown, relaxation level, fallback reason, timings (where available).
- [ ] **Reliability dashboard:** strict success %, fallback %, P0 rejection %, avg relaxation level (from metrics + logs).
- [ ] **Determinism dashboard:** request hash, trace hash, output hash, “verified deterministic” flag (from replay or N-run check).

**Phase 2 exit criteria:** Demo in < 3 minutes: open trace explorer on a real response.

---

## PHASE 3 — Observability + ops (1 week)

**Goal:** Production-style operations.

- [x] Structured logging (**Pino**): `requestId`, `traceId`, `stage`, `latencyMs`, `failureReason`, `relaxationLevel` (via pipeline + orchestrator events).
- [x] Metrics: extend `/metrics` with **engine_health**; add **`GET /metrics/prometheus`** for Grafana; **Prometheus + Grafana** in Docker (`--profile telemetry`).
- [ ] **OpenTelemetry** (optional): spans for orchestrator → optimizer → DB — deferred.
- [x] Failure injection env flags: `SIMULATE_DB_DOWN`, `SIMULATE_AI_TIMEOUT`, `SIMULATE_EMPTY_CANDIDATES` (dev only).

**Phase 3 exit criteria:** One dashboard answers “is the engine healthy?” without reading logs.

---

## PHASE 4 — Transactional safety (4–6 days)

- [x] **Atomic writes (orchestrator post-plan path):** `user_meal_history` inserts + `decision_logs` upsert in a **single transaction** (`planDecisionPersistence` + `pg.withTransaction`). Weekly adherence remains on the **feedback** upsert path (separate flow).
- [x] **Retries:** bounded **PostgreSQL** query retries (`AAROGYA_PG_QUERY_RETRIES`); **Redis** connect backoff already present; GET path drops dead client after failure; **AI** HTTP timeouts/retries remain env-driven (`AAROGYA_*_TIMEOUT`, `AAROGYA_RAG_RETRIES`).
- [x] **Graceful shutdown:** `SIGINT` / `SIGTERM` drain HTTP (`server.close`), **Redis quit**, **PG pool end**, **Pino flush**.

---

## PHASE 5 — Recipe-first migration (2–3 weeks)

**Goal:** `RecipeAggregate_v1` as **canonical** optimizer/scoring input (see [ROADMAP.md](ROADMAP.md) execution order).

- [ ] Ingredient-level constraints + recipe-level explainability.
- [ ] PRD R-01/R-02 acceptance criteria (already drafted in [PRD.md](PRD.md) §5.7).

---

## PHASE 6 — Performance + scale (1 week)

**Goal:** bounded hot-path cost, measurable optimizer behavior, optional non-critical deferral hook.

- [x] Reduce defensive cloning on optimizer output (`cloneFood` fast path when no triggered rules).
- [x] Optimizer: per-category top-K cap, beam width cap, dedupe + intermediate pool cap, single-sort prune; env-tunable (`AAROGYA_OPTIMIZER_*`).
- [x] Telemetry: `optimizer_search` counters in `/metrics` snapshot + Prometheus text (`aarogya_optimizer_beam_*`).
- [x] Greedy path: O(n) winner selection (no full-array sort).
- [x] `runDeferredNonCritical` utility (`AAROGYA_DEFER_NON_CRITICAL`) for future async analytics / workers (persistence remains synchronous).

---

## PHASE 7 — Frontend polish (1 week)

**Style:** engineering dashboard (Grafana / Linear / Datadog vibe) — **not** wellness marketing UI.

- [x] Trace-first layout: pipeline strip on Trace, ops quick links, observability nav (metrics / reliability / logs).
- [x] Ops dashboard: `/health` tile, telemetry metrics, session readiness; side panel P0 + deep links.
- [x] Assistive Q&A restyled (read-only boundary, no plan mutations); shell nav + slate engineering theme.

---

## PHASE 8 — Deployment + portfolio (4–5 days)

- [ ] Deploy: frontend + backend + postgres + redis (+ optional telemetry stack).
- [ ] CI/CD: extend GitHub Actions with deploy smoke, contract gates (already partially there).
- [ ] Docs: `THREAT_MODEL.md`, `FAILURE_ANALYSIS.md`, `RELIABILITY_MODEL.md` (can split from PRD § risks).
- [ ] Assets: architecture diagram, pipeline diagram, trace screenshots, Grafana captures.

---

## Resume one-liner (target)

> Deterministic, contract-first meal optimization service: beam-search optimizer, staged reliability with P0-verified outputs, schema-governed APIs, AI boundary enforcement, observability, and traceable execution — designed for auditability and failure-aware operation.

---

## Execution order (what to do next)

1. **Finish Phase 0.1** health semantics + startup logging hygiene.  
2. **Phase 0.3** docker compose or `npm run dev` orchestration.  
3. **Phase 1** determinism + P0 suites — this is the **interview moat**.  
4. Phases 2–8 in order above; **do not** start Phase 6 before Phase 1 proves correctness.

This file is the **master checklist**; update checkboxes as work lands.

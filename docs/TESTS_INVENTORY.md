# Backend test inventory (`apps/backend/tests`)

**Purpose:** Map **what runs in CI** vs **what you run locally** when changing a subsystem. CI definition: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

**One-shot local gate (matches CI):** from repo root, `npm run verify` (lint + build + `test:all` + `test:extended` + **`test:phase1`** + `golden-path-smoke`).

---

## CI pipeline (always on push / PR)

| Step | Command | Notes |
|------|---------|--------|
| Lint | `npm run lint` | Backend + frontend ESLint |
| Build | `npm run build` | Backend `package.json` maps this to **`node tests/testLLMHardValidation.js`** (hard LLM / schema gate) |
| Core suite | `npm run test:all` | Sequential engine tests (no DB required) |
| Extended | `npm run test:extended` | Files listed in `apps/backend/scripts/run-extended-tests.js` |
| Phase 1 | `npm run test:phase1` | `scripts/run-phase1-ci.js` → determinism + P0 + startup/contracts (see below) |
| Smoke | `npm run golden-path-smoke` | In-process planner golden path |

---

## `test:all` — files in order (`apps/backend/package.json`)

1. `tests/testFoodDB.js`
2. `tests/testMealTemplate.js`
3. `tests/testCandidate.js`
4. `tests/testCandidateGenerator.js`
5. `tests/testConstraintEngine.js`
6. `tests/testRules.js`
7. `tests/testScoring.js`
8. `tests/testScoringEngine.js`
9. `tests/testDiversityEngine.js`
10. `tests/testOptimizer.js`
11. `tests/testPipeline.js`
12. `tests/testIntegration.js`
13. `tests/testSystem.js`
14. `tests/testUserState.js`

---

## `test:extended` — `scripts/run-extended-tests.js`

Runs **without PostgreSQL** (JSON catalog fallbacks). Order matters (fail-fast chain):

1. `tests/testHealthDegradedDb.js`
2. `tests/testValidationBoundaries.js`
3. `tests/testTraceNoHealing.js`
4. `tests/testMetrics.js`
5. `tests/testAIBoundary.js`

Startup + rule-schema checks moved to **`npm run test:phase1`** (`run-startup-contracts-ci.js`) to avoid duplicate work in CI.

To add a new always-on, no-DB test for CI: append the path here **or** into the appropriate Phase 1 runner; keep the file **self-contained** (exit non-zero on failure).

---

## Phase 1 — `npm run test:phase1` (`scripts/run-phase1-ci.js`)

Runs after `test:extended` inside **`npm run verify`**. Sub-runners:

### `test:determinism-ci` (`scripts/run-determinism-ci.js`)

1. `tests/determinism/testGoldenFixtureDeterminism.js`
2. `tests/testDeterminismStrict.js`
3. `tests/testPhase1Determinism.js`
4. `tests/testReplaySystem.js`
5. `tests/testDeterminism.js`

Narrative: [DETERMINISM_REPORT.md](DETERMINISM_REPORT.md).

### `test:p0-ci` (`scripts/run-p0-ci.js`)

1. `tests/p0/testMaliciousAiProfileBoundary.js`
2. `tests/testP0Enforcement.js`
3. `tests/testP0ConstraintCatalog.js`
4. `tests/testP0SafetyProof.js`
5. `tests/testFallbackP0Safety.js`
6. `tests/testFailLoudNoPlan.js`

### `test:startup-contracts-ci` (`scripts/run-startup-contracts-ci.js`)

1. `tests/testStartupRuleValidation.js`
2. `tests/testRuleSchemaAlignment.js`
3. `tests/startup/testContractSchemaSmoke.js`

End-to-end **`tests/testResponseContracts.js`** remains a **manual** harness (orchestrator output shape may drift ahead of strict `DecisionResponse_v1` AJV until aligned in a focused PR).

---

## `golden-path-smoke`

- `apps/backend/scripts/golden-path-smoke.js` (not under `tests/`)

---

## Other `npm` scripts (`apps/backend/package.json`) — not duplicated in CI as separate steps

These are **developer shortcuts** (run when you touch that area):

| Script | Entry |
|--------|--------|
| `test:determinism-ci` | `scripts/run-determinism-ci.js` |
| `test:p0-ci` | `scripts/run-p0-ci.js` |
| `test:startup-contracts-ci` | `scripts/run-startup-contracts-ci.js` |
| `test:phase1` | `scripts/run-phase1-ci.js` (aggregate) |
| `test:candidate` | `testCandidate.js`, `testCandidateGenerator.js` |
| `test:rules` | `testRules.js`, `testConstraintEngine.js` |
| `test:scoring` | `testScoring.js`, `testScoringEngine.js` |
| `test:optimizer` | `testOptimizer.js` |
| `test:pipeline` | `testPipeline.js`, `testIntegration.js` |
| `test:determinism` | `testDeterminism.js` |
| `test:system` | `testSystem.js`, `testSystemValidation.js` |
| `test:llm` / `test:llm-hard` | `testLLMHardValidation.js` |
| `test:ai-boundary` | `testAIBoundary.js` |
| `test:contracts` | `testResponseContracts.js` |
| `test:daily-plan` | `testDailyPlanApi.js` |
| `test:load` | `../../infrastructure/scripts/loadtest.js` (repo root `infrastructure/`) |

---

## Manual / local-only (not in default CI)

Use these when iterating on APIs, Phase-1 harnesses, proofs, or module isolation. **Do not** assume CI runs them unless you extend `.github/workflows/ci.yml` or `run-extended-tests.js`.

### `tests/modules/` (focused module harnesses)

- `tests/modules/testCandidate.module.js`
- `tests/modules/testConstraint.module.js`
- `tests/modules/testDiversity.module.js`
- `tests/modules/testOptimizer.module.js`
- `tests/modules/testPipeline.module.js`
- `tests/modules/testReliability.module.js`
- `tests/modules/testScoring.module.js`

### `tests/*.js` (local harnesses — excludes `test:all`, `test:extended`, and **`test:phase1`** suites above)

- `tests/testAIDisagreementMetrics.js`
- `tests/testApiIdempotencyHealth.js`
- `tests/testApiPlanExecution.js`
- `tests/testApiValidation.js`
- `tests/testCacheContract.js`
- `tests/testConfidenceModel.js`
- `tests/testConsumabilityApis.js`
- `tests/testContractBuilders.js`
- `tests/testContractSafety.js`
- `tests/testCrossSlotCompatibility.js`
- `tests/testDailyPlanApi.js`
- `tests/testDashboardTelemetryApi.js`
- `tests/testFailLoud.js`
- `tests/testFailureCasesProof.js`
- `tests/testFallbackRateClamp.js`
- `tests/testGoldenDatasetProof.js`
- `tests/testLLMHardValidation.js` *(also invoked via `npm run build` / `test:llm`)* 
- `tests/testOptimizerBenchmark.js`
- `tests/testOptimizerCompatibility.js`
- `tests/testOptimizerFailureModes.js`
- `tests/testPersistentDiversity.js`
- `tests/testPhase1AdaptiveScoring.js`
- `tests/testPhase1FinalAdaptiveOutput.js`
- `tests/testPhase1FinalHistoryRepository.js`
- `tests/testPhase1FinalNoPlanFallback.js`
- `tests/testPhase1FinalNutritionWeekly.js`
- `tests/testPhase1FinalTraceRealConstraints.js`
- `tests/testPhase1FixScalingOutput.js`
- `tests/testPhase1FixTraceIntegrity.js`
- `tests/testPhase1FixWeeklyDiversity.js`
- `tests/testPhase1RecipeScaling.js`
- `tests/testPhase1WeeklyPlanner.js`
- `tests/testPrakritiApi.js`
- `tests/testRefinement.js`
- `tests/testRelaxationLadder.js`
- `tests/testResponseContracts.js` *(manual — full orchestrator output vs `DecisionResponse_v1`; not in `test:phase1` until aligned)*
- `tests/testSystemValidation.js` *(also in `npm run test:system`)* 
- `tests/testTraceConsistency.js`
- `tests/testTraceFidelityProof.js`
- `tests/testTraceIntegrity.js`
- `tests/testWeeklyPlan.js`

*(Determinism / P0 / startup-contract files that are CI-gated live under **`npm run test:phase1`** — see Phase 1 section.)*

---

## Hygiene notes

- Prefer **adding** extended-tier tests to `scripts/run-extended-tests.js` when they are fast, hermetic, and encode a regression you care about in CI.
- **Determinism / P0 / startup-contract** regressions belong in **`scripts/run-phase1-ci.js`** (or its sub-runners).
- Removed **dead** scratch file: `tests/verifyPlan.js` (broken `require` path and non-contract payload).
- Removed duplicate **`packages/contracts/`** tree (unused copy of backend contracts; canonical path is `apps/backend/src/contracts/`).

# Architecture

## Alignment Decision

Chosen approach: **Option B (documentation alignment)**.

Reason:
- Runtime is already contract-first and deterministic.
- ML is assistive and optional behind schema + confidence gating.
- Optimizer is beam-first with deterministic greedy fallback.
- Reliability flow: strict pass, then staged rule **exclusion** for recovery levels **1 → 2 → 3** (exclude P3; then P2+P3; then P1+P2+P3), then safe fallback. **P0 is never excluded**; **every** emitted plan is **P0 output-validated**. (See `reliabilityEngine.js` `RELAXATION_LEVELS` and `assertP0Compliance`.)

This document now reflects the implemented system exactly.

## Current Runtime (Contract-First, Deterministic)

Primary end-to-end flow:

1. API receives `DecisionRequest_v1` and validates schema.
2. Adapter normalizes input to canonical internal structure.
3. Pipeline resolves template and candidate categories.
4. Constraint engine applies deterministic reject/penalize logic.
5. Scoring computes bounded deterministic scores.
6. Diversity applies deterministic repetition penalties.
7. Optimizer selects combination (beam-first; deterministic tie-breaks).
8. Reliability layer applies controlled recovery if needed.
9. Response builder emits contract-valid `DecisionResponse_v1` + `Trace_v1`.
10. Explanation layer provides deterministic explanation text; AI narrative is optional.

Primary orchestrators:
- `src/pipeline/pipeline.js`
- `src/pipeline/orchestrator.js`

## Module Boundaries

- `food`: schema validation and canonical food entities
- `rules`: deterministic logic-tree evaluation
- `candidate`: category-level shortlisting + prefilters
- `scoring`: nutrition + dosha + digestibility synthesis
- `diversity`: repetition-aware penalties
- `optimizer`: beam-first optimization with deterministic greedy fallback
- `reliability`: controlled relaxation + safe fallback + confidence shaping
- `explanation`: deterministic narrative + optional AI augmentation

## Assistive ML Boundary (Optional, Non-Decision)

ML is **optional assistive input**, not a decision maker.

Implemented behavior:
- Deterministic parser/profile is always available.
- AI output is accepted only if schema-valid and confidence-gated.
- AI failure or invalid schema never blocks deterministic decision completion.
- AI cannot introduce decision fields (`meal`, `selection`, etc.).

## Reliability Semantics (Implemented)

Staged recovery in `reliabilityEngine.computeReliabilityResult`:

1. **Level 0 (strict):** full rule set; if optimizer yields a non-empty plan, return after P0 compliance check.
2. **Level 1:** active rules exclude **P3** only.
3. **Level 2:** active rules exclude **P2** and **P3**.
4. **Level 3:** active rules exclude **P1**, **P2**, and **P3** (deepest recovery before generic fallback).
5. If still no plan: **safe fallback** (`getFallbackMeal` / emergency P0-safe path), then P0 compliance check.

Important:

- **P0 is never excluded** from the filter pass (it is not listed in `excludedPriorities` at any level).
- **P1** may be excluded **only at level 3** when levels 1–2 did not yield a feasible plan.
- **P0 compliance** is asserted on the **output** meal plan for every return path (`assertP0Compliance`).
- All fallback/relaxation outcomes are surfaced in metadata and trace context.

## Confidence Model (Implemented)

For `DecisionResponse_v1`, confidence is contract object `Confidence_v1`:
- `value` in `[0,1]`
- `level` derived from value (`low`, `medium`, `high`)
- `components`:
  - `penalty_impact`
  - `diversity_impact`
  - `relaxation_impact`

Confidence is descriptive metadata and does not change deterministic selection logic.

## Determinism Guarantees

- Priority-sorted rule evaluation
- Deterministic tie-breaking in selection/combination
- Bounded score and confidence values
- Contract-validated request/response boundaries
- Trace stage transition integrity checks
- Idempotent cache keys via stable request hashing

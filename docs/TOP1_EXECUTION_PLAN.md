# Top 1 Percent Execution Plan (AYUDIET)

## Verdict on Current Roadmap
Your phase direction is correct. The missing part is strict acceptance gates tied to code paths and tests.

## Build -> Prove -> Expose -> Scale -> Demonstrate

### Phase A: Core Trust + Architecture
Acceptance gates:
- Deterministic engine is authoritative for meal choice (Node only).
- AI is assistive only (profile + explanation) and cannot generate meals.
- Fallback never uses hardcoded meal names and remains P0-safe.
- Request/Response boundaries are validated.
- Candidate cache key includes `userState + template + rulesVersion`.

### Phase B: Deterministic Proof
Acceptance gates:
- Same input for 100 runs gives identical normalized output.
- P0 constraints never violated (automated test suite).
- Trace reflects actual stage outputs.
- Replay artifact stores input/output/trace for re-execution.

### Phase C: Engineering Depth
Acceptance gates:
- Recipe-level aggregate is the runtime unit.
- Optimizer uses greedy + beam with pruning metrics.
- Diversity engine applies history-aware penalties.

### Phase D: Product Layer
Acceptance gates:
- Trace viewer shows candidate -> constraints -> scoring -> optimizer.
- Explanation panel separates deterministic facts from AI narrative.
- Meal output includes recipe quantities and nutrition.

### Phase E: Production Hardening
Acceptance gates:
- PostgreSQL and Redis integrated in serving path.
- Observability tracks latency, fallback rate, confidence.
- Async AI calls never block deterministic decision completion.

### Phase F: Proof System
Acceptance gates:
- Dashboard shows fallback rate, latency distribution, confidence distribution.
- AI evaluation reports schema compliance and failure rates.
- README documents architecture, contracts, trade-offs, and benchmark outcomes.

## Immediate Priority Checklist
1. Lock contract versions used in runtime validators.
2. Remove legacy fallback and legacy pipeline ambiguity.
3. Add deterministic + replay tests to CI.
4. Finish recipe-level migration as the sole runtime mode.

# Determinism report (Phase 1.1)

**Policy:** Same structured planner input (including fixed `meta.timestamp` where applicable) must yield the same **canonical payload** for `meal_plan` + `trace` when non-timing fields are compared. Timing and audit side-effects are excluded from hashes.

## CI enforcement

GitHub Actions runs **`npm run verify`**, which includes **`npm run test:phase1`** → **`scripts/run-determinism-ci.js`**.

### Suites (in order)

| Order | File | Intent |
|------:|------|--------|
| 1 | `tests/determinism/testGoldenFixtureDeterminism.js` | Golden input (fixed clock) → two runs → identical SHA-256 over canonical `{ meal_plan, trace, score }`. |
| 2 | `tests/testDeterminismStrict.js` | Orchestrator: output + trace hashes stable over 100 runs. |
| 3 | `tests/testPhase1Determinism.js` | Pipeline internal: `_runPipelineInternal` hash stable. |
| 4 | `tests/testReplaySystem.js` | Replay engine reproduces trace + output hashes. |
| 5 | `tests/testDeterminism.js` | Broad orchestrator equality (100 runs, meta latency stripped). |

## Versioning

Breaking wire or schema changes require **`_v2`** contracts (see [PRD.md](PRD.md)); determinism suites must be updated alongside golden fixtures.

## Local

```bash
cd apps/backend
npm run test:determinism-ci
```

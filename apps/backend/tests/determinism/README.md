# Determinism suite (Phase 1.1)

Canonical **CI** entry: `npm run test:determinism-ci` (runs `scripts/run-determinism-ci.js`).

**Principles:** fixed clocks in fixtures, no network-only randomness in compared payloads, identical orchestrator output for identical input.

See [docs/DETERMINISM_REPORT.md](../../../docs/DETERMINISM_REPORT.md) for the interview narrative and checklist.

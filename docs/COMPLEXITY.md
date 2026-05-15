# Complexity Analysis

This document defines the deterministic runtime and memory profile for the AAROGYA decision pipeline under the Phase 3 proof system plus engineering-depth instrumentation.

## Time Complexity

Candidate Generation: `O(n)`

Constraint Filtering: `O(n * r)`

Scoring: `O(n)`

Diversity: `O(n)`

Optimizer:

- Greedy: `O(n log n)`
- Beam: `O(k * n log n)`

Where:

- `n` is the number of candidates entering a stage.
- `r` is the number of active rules evaluated during constraint filtering.
- `k` is the configured beam width.

## Space Complexity

Overall space complexity is `O(n)`.

Each stage keeps deterministic per-candidate metadata and bounded intermediate structures. Beam search increases constant factors through partial-combination state, but remains linear with respect to candidate storage for the configured beam width used in runtime.

## Validation Notes

- Benchmarks use the actual pipeline stages: candidate generation, constraints, scoring, diversity, then optimizer comparison.
- Optimizer comparison is measured on real candidate maps emitted by the deterministic pipeline.
- Failure-mode tests validate that greedy can become suboptimal under cross-slot compatibility pressure while beam can recover a better complete solution.
- Cross-slot compatibility tests verify that rejected candidates do not re-enter the optimizer path.

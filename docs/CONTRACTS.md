# Contracts

## Global Governance

Every schema includes:
- `version`
- `schema_version`
- `compatibility`

Evolution policy:
- Additive-only minor changes
- No in-place rename/deletion
- Deprecation via explicit flags/notes
- Breaking changes require new version suffix (for example `_v2`)

## Active Runtime Contracts

Core:
1. `DecisionRequest_v1`
2. `DecisionResponse_v1`
3. `Trace_v1`
4. `ErrorResponse_v1`

Assistive:
5. `AIProfileOutput_v1`

Weekly API:
6. `WeeklyDecisionRequest_v1`
7. `WeeklyDecisionResponse_v1`

## Boundary Enforcement

- Node.js runtime validation: AJV + explicit validators
- Fail-loud behavior at API boundaries

Trust boundaries:
- `DecisionRequest_v1`: trusted only after validation
- `AIProfileOutput_v1`: untrusted until schema + confidence gating
- `DecisionResponse_v1`: validated before emit
- Weekly request/response contracts validated in route handler

## Confidence Model (Schema-Aligned)

### DecisionResponse (`Confidence_v1` object)

`confidence` is a structured object:
- `value` in `[0,1]`
- `level` in `{low, medium, high}`
- `components` in `[0,1]`:
  - `penalty_impact`
  - `diversity_impact`
  - `relaxation_impact`

Derivation is deterministic and bounded in response builder.

### WeeklyDecisionResponse (day-level scalar)

`weekly_plan[].confidence` is a bounded scalar `[0,1]` representing per-day aggregate confidence summary.

## Data Constraints

- Scores and confidence in `[0,1]`
- Dosha values in `[0,1]` (normalized by builder paths)
- Macros, calories, grams are non-negative
- Controlled enums reject free text
- Deterministic IDs and timestamps are preserved across traceable operations

## Identity & Trace

- Request carries `request_id` and `trace_id` in contract-first API flow
- Response preserves IDs and returns `Trace_v1`
- Logs and observability index by request/trace identifiers

## Reliability Contract Notes

Implemented recovery path is:
- Relax `P3`
- Relax `P2 + P3`
- Final `P0`-safe fallback

`P0` remains non-relaxable.
`P1` relaxation is not part of the current implemented fallback path.

## Aggregation Rules Lock (`RecipeAggregate_v1`)

- Nutrition: sum
- Dosha effects: grams-weighted
- Digestibility: weighted average
- GI: carbs-weighted average

These rules are deterministic and must remain identical between runtime and tests.

# Idempotency Policy

For idempotent replay of identical request payloads:

## Deterministic Payload (must remain unchanged)
- `meal_plan`
- `nutrition_summary`
- `score`
- `confidence`
- `trace`
- `explanation`

## Mutable Metadata (allowed to differ)
- `meta.cache_hit`
- `meta.served_latency_ms`
- transport-dependent timing fields only

No route may mutate deterministic payload fields for cache-hit responses.

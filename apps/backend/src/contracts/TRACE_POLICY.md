# Trace Policy

## Decision Endpoints
- `POST /plan`
- `POST /weekly-plan`
- Decision action endpoints returning `DecisionResponse_v1`

These responses must include full `Trace_v1` in `trace` and top-level `trace_id`.

## Assistant Endpoints
- `POST /explain`
- `POST /profile`

These responses must use `AssistantResponse_v1` and include top-level `trace_id` (plus `meta.trace_id`).
They must not include full `Trace_v1`.

## Ops Endpoints
- `GET /health`
- `GET /metrics`

These responses must include top-level `trace_id`.
They must not include full `Trace_v1`.

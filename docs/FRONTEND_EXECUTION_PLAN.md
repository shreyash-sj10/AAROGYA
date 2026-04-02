# AYUDIET — Final Frontend Roadmap (Master Lock)

This document is the locked, production-aligned frontend execution roadmap.
No ambiguity, no missing pieces.

## 0. System Positioning
Do not build this as a generic diet app or chatbot UI.
Build it as a deterministic decision system dashboard with full observability.

Every UI flow must reflect:
- contract-first behavior
- fail-loud error handling
- traceability
- deterministic outputs

## 1. Core Frontend Foundation (Build First, Non-Negotiable)

### Folder Structure (Locked)
```text
frontend/
  src/
    app/
    pages/
    components/
    services/
    contracts/
    state/
    utils/
```

### Mandatory Foundation
1. API client (`apiClient.ts`)
   - timeout handling
   - error normalization
   - trace propagation
   - retries only for safe endpoints
2. Contract layer
   - `DecisionRequestV1`
   - `DecisionResponseV1`
   - `TraceV1`
   - `ErrorResponseV1`
3. Validation layer
   - validate before request send
   - validate after response receive
   - strict schema checks
4. Identity system
   - generate frontend `request_id`
   - display `request_id`
   - propagate `trace_id`

## 2. Component System (Build Early)
Core components:
- `JsonViewer`
- `MetricCard`
- `ConfidenceBadge`
- `StatusBadge`
- `ErrorBanner`
- `ValidationPanel`
- `StageCard`

Rule: each component must map to a system concept.

## 3. Phase 1 — System Dashboard (Primary Build)
Timeline: 6-7 days
Goal: demo-ready deterministic system dashboard.

### 3.1 Plan Builder (`/system/builder`)
Purpose: create valid `DecisionRequest_v1`.

Must include:
- strict form with enum-based fields
- inline validation
- request JSON preview
- visible `request_id`
- validation panel:
  - schema checks
  - enum checks
  - bounds checks

### 3.2 Plan Result (`/system/result`)
Purpose: render `DecisionResponse_v1`.

Must show:
- `meal_plan`
- `nutrition_summary`
- `score`
- `confidence` (value + level)
- explanation
- `latency_ms`
- `cache_hit`
- `rule_version`
- `scoring_version`
- retry button

### 3.3 Trace Viewer (`/system/trace`) — USP
Purpose: expose decision trace with clarity.

Must show:
- stage name
- input to output transitions
- duration
- rejected count
- penalties
- combinations evaluated

Rule: optimize for clarity, not decorative UI.

### 3.4 System Health (`/system/health`)
Must show:
- DB status
- Redis status
- AI status
- last success timestamp
- degraded-state message

### 3.5 Metrics Dashboard (`/system/metrics`)
Must show:
- request count
- average latency
- p95 latency
- fallback rate
- error rate
- confidence distribution
- AI metrics

## 4. Global Error System (Mandatory)
Error types:
- validation errors: inline
- API errors: banner
- system errors: page-level state

Always display:
- error type
- source
- message
- `trace_id`

## 5. Build Execution Plan (Locked)
1. Day 1-2:
   - app shell
   - routing
   - API client
   - validators
   - base components
2. Day 3:
   - Plan Builder complete with strict validation
3. Day 4:
   - Plan Result integrated with API
4. Day 5:
   - Trace Viewer core implementation
5. Day 6:
   - Health + Metrics pages
6. Day 7:
   - polish
   - integration fixes
   - responsiveness
   - error-flow testing

## 6. Definition of Done (Phase 1)
Done means all are true:
- full request to response to trace flow works
- strict request and response validation enforced
- no silent frontend failure paths
- trace fully visible and interpretable
- health and metrics visible and usable
- demo-ready experience

## 7. Phase 2 — Patient UI (Only After Phase 1)
Build:
1. Onboarding
   - collect user data
   - map into request contract
2. Meal View
   - clear meal display
   - explanation
   - confidence

Do not build yet:
- chat UI
- adaptive UI
- weekly planner

## 8. Phase 3 — Advanced Features (After Stability)
### Chat Interface
Only after:
- orchestrator support exists
- structured intent mapping exists

### Adaptive UI
Only after:
- real user data exists
- backend supports adaptation signals

### Weekly Planner
Only after:
- stable API exists
- contract is finalized

## 9. Production Hardening
### Observability
- show latency
- show cache behavior
- show trace details

### Performance
- memoization where needed
- avoid unnecessary rerenders

### Accessibility
- keyboard navigation
- clear text hierarchy and readability

### Testing
- contract validation tests
- API integration tests
- error-path tests

## 10. Final Demo Flow
1. Build request
2. Show validation status
3. Submit
4. Show result
5. Show trace
6. Show metrics
7. Show system health

Demo statement:
"The frontend enforces strict contracts, exposes deterministic decision flow, and provides full system observability."

## Final Verdict
Roadmap is locked as:
- complete
- production-aligned
- system-consistent
- interview-ready

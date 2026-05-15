# COMPLETE PROJECT DEFENSE GUIDE: AAROGYA

## 1. ONE LINE PITCH
AAROGYA is a contract-first deterministic meal-planning platform for Ayurveda-informed nutrition decisions.

Project overview: This project is a monorepo with a React frontend (`apps/frontend`), an Express backend (`apps/backend/src/server.js`), and an optional assistive AI service path. The core decision path is deterministic in backend modules, and versioned request/response contracts are validated in both backend and frontend (`apps/backend/src/contracts`, `apps/frontend/src/contracts`, `apps/frontend/src/validators`).

## 2. WHY YOU BUILT IT
The problem this system addresses is that nutrition planning systems often produce recommendations that are hard to audit and can violate strict user constraints under edge cases. In this codebase, the backend explicitly models hard and soft rule priorities and validates output contracts before returning a response, which shows the design goal was reliability over novelty.

Existing alternatives fail for this use case when decision logic is opaque, non-repeatable, or tightly coupled to external AI services. In AAROGYA, AI is routed as assistive capability and not trusted for core selection fields, while the deterministic orchestration path remains in Node (`apps/backend/src/core/pipeline/orchestrator.js`, `apps/backend/src/api/plan.routes.js`).

The core insight is to separate deterministic decision generation from optional AI enrichment and to force contract conformance at system boundaries. Success for this project means the same structured request shape consistently yields contract-valid responses with safety constraints preserved, even when DB/Redis/AI degrade.

## 3. ARCHITECTURE
Each component has a focused role. The frontend manages onboarding, planner input, and observability pages; it sends HTTP requests through a typed API client (`apps/frontend/src/services/api/apiClient.ts`). The backend API layer handles validation, idempotency, auth-protected context operations, and route orchestration (`apps/backend/src/server.js`, `apps/backend/src/api/plan.routes.js`, `apps/backend/src/routes/user.routes.js`). The deterministic engine modules perform candidate generation, constraint filtering, scoring, diversity, optimization, and reliability fallback. Persistence is split across PostgreSQL tables plus Prisma-managed user/auth/context storage. Redis is optional and can fall back to in-memory cache (`apps/backend/src/services/cache/redis.service.js`).

Components communicate over HTTP and in-process module calls. The frontend calls backend endpoints like `/plan`, `/plan/daily`, `/plan/weekly`, `/health`, and `/metrics`. The backend route handlers invoke service/pipeline modules and repositories. State primarily lives in PostgreSQL for durable data, in Redis or memory for short-lived cache/idempotency behavior, and in frontend Zustand stores for UI/session state (`apps/frontend/src/store/*`).

This architecture was chosen over a fully AI-driven or frontend-heavy decision model because deterministic backend ownership gives auditable behavior and stronger failure isolation. The tradeoff is slower feature iteration because schema and rules must be changed deliberately.

If the frontend goes down, users lose UI access but backend APIs still run. If the backend API is down, planning and auth flows stop. If PostgreSQL is unavailable, the backend can enter degraded behavior for some flows and emits DB warnings; protected auth/context workflows can fail because Prisma-backed operations need DB connectivity. If Redis goes down, cache falls back to memory. If AI is down, assistive routes degrade but deterministic planning can still run.

Single points of failure currently include the backend API process and database availability for auth/context paths. Redis is not a hard SPOF due to fallback behavior.

For interviewer challenge questions: separating API routes from pipeline modules limits coupling and keeps contract validation centralized; replacing PostgreSQL would require repository and migration changes but not frontend contract changes; request flow starts at `apiClient.ts`, enters `server.js` middleware, then route handler, then pipeline services, then response validation; under load, bottlenecks are likely DB connections, optimizer complexity, and single-process memory/cpu constraints.

## 4. SYSTEM FLOW
Flow 1 (weekly planning): A user action from planner UI triggers a client request to `POST /plan/weekly`. The frontend composes a typed payload and sends it through the API client with optional auth header (`apps/frontend/src/services/api/plan.api.ts`, `apiClient.ts`). The backend route validates request schema with `validatePlanWeeklyRequest`, runs weekly planner generation, validates `PlanWeeklyResponse_v1`, and returns JSON (`apps/backend/src/api/plan.routes.js`). DB reads/writes are repository-dependent inside planner/orchestrator paths; if DB is unavailable, fallback behavior can be used in parts of the planning pipeline. This flow is not wrapped as a single DB transaction end-to-end, so atomicity is module-specific.

Flow 2 (decision action replace/regenerate): The client calls `/replace-food` or `/regenerate-meal`. Route-level AJV schemas validate required fields and reject malformed input. The handler converts action payload into `DecisionRequest_v1`, validates it, calls deterministic `generateMealPlan`, validates `DecisionResponse_v1` and `Trace_v1`, and returns or errors (`apps/backend/src/api/routes/decisionActions.routes.js`). Realtime events are not emitted; this is request/response only.

Flow 3 (auth + user context persistence): User signs up/logs in via `/auth/signup` and `/auth/login`; bcrypt hashes passwords and JWT tokens are issued with 1-hour expiry (`apps/backend/src/controllers/auth.controller.js`). Frontend stores token in local storage and Zustand auth store (`apps/frontend/src/store/auth.store.ts`, `apps/frontend/src/services/auth/auth.api.ts`). For context persistence, frontend sends bearer-authenticated requests to `/user/context`; `authMiddleware` verifies JWT secret, bearer header, and token payload before Prisma upsert/read (`apps/backend/src/middleware/auth.middleware.js`, `apps/backend/src/routes/user.routes.js`).

In all three flows, validation occurs both client-side contract parsing and server-side schema checks. Error cases return structured responses or explicit error objects. Safe retries vary by endpoint: GET retry support exists in `apiClient.ts`, while non-idempotent writes rely on server behavior and are not universally transaction-protected.

## 5. TECH STACK
React + Vite + TypeScript were used for fast component iteration with compile-time safety and contract-aware client validation. This is lighter than heavier SSR stacks for this workload, but it gives up built-in server rendering.

Node.js + Express were used for broad ecosystem support and direct control over middleware composition in a single process (`server.js`). This is straightforward but can be less performant than lower-overhead frameworks in high-throughput scenarios.

PostgreSQL with Prisma plus raw `pg` access is used. Prisma simplifies auth/context CRUD, while raw queries and SQL migrations provide explicit control for planning data paths. The tradeoff is operational complexity from dual access patterns.

Redis is optional. The cache layer intentionally degrades to memory when Redis is unavailable, which improves resilience but introduces single-instance cache semantics under fallback.

JWT + bcrypt are used for stateless auth and password hashing. JWT avoids server-side session store dependency, but token handling and rotation policies become critical.

Version evidence from repo manifests: root/workspace dependencies and app manifests in `package.json`, `apps/backend/package.json`, and `apps/frontend/package.json`.

## 6. DATA MODEL
This project has mixed persistence definitions. Startup DB validation explicitly requires nine public tables: `food_catalog`, `rule_catalog`, `meal_templates`, `preferences`, `user_meal_history`, `user_weekly_adherence`, `daily_state`, `weekly_plans`, and `users` (`apps/backend/src/server.js`, `validateDbCatalog`).

Prisma models currently define `User`, `UserContext`, `UserMealHistory`, and `UserWeeklyAdherence` (`apps/backend/prisma/schema.prisma`). Additional SQL schema and migrations define planning and recipe-related tables (`infrastructure/db/schema.sql`, `infrastructure/db/migrations/create_recipe_system.sql`, `20260401_production_persistence.sql`).

Primary/unique/index evidence includes: `User.email` unique, `UserContext.userId` unique, `(user_id, week_id)` unique on weekly adherence, and multiple SQL indexes for category/rules/history queries. Foreign keys are present in SQL schemas for recipe ingredients and aggregate relationships.

After one meal plan operation, expected persistent state depends on enabled DB paths and repository wiring. At minimum, planning requests can execute with fallback catalogs; with DB enabled and repository paths active, decision artifacts/history/adherence can be persisted by backend services.

## 7. BACKEND DEEP DIVE
Request lifecycle begins in `server.js` where middleware order is: CORS, JSON parser, request context middleware, API telemetry middleware, auth/user route mounts, then API route registration, then global error handler. This order matters because telemetry and context are attached before route execution.

Routes are thin orchestration layers and validation boundaries. Business logic is pushed into services/modules (planner, reliability, repositories, adaptive scoring). Utilities handle safety conversion and contract/error shaping.

Database access is through Prisma for auth/context and `pg` service for query/transaction utilities. SQL injection risk is reduced where parameterized queries are used (`pg.query(text, values)` pattern). There is no universal transaction wrapper for all multi-step route flows; only explicit `withTransaction` calls are atomic.

Error handling maps known failure classes to status codes in route layers. Health endpoint is intentionally fail-soft and returns degraded checks instead of hard crashing when dependencies are down (`getDatabaseHealth`, `/health` path). Unhandled startup errors can terminate process; graceful shutdown handlers exist for SIGINT/SIGTERM.

Background worker behavior is limited in this codebase; most execution is synchronous request-path processing. Where scripts exist (tests/smoke/phase checks), they are run as CI tasks rather than long-lived worker daemons.

## 8. FRONTEND DEEP DIVE
Global state uses Zustand stores for auth, plan, onboarding, health, and metrics. Auth token is persisted in local storage, but authentication state is not auto-marked true from storage alone; explicit initialization logic runs (`auth.store.ts`, `useAuthInit.ts`).

Local component state is used for page-specific UI interactions, while API data and contract parsing are handled in service modules. Requests are sent through a shared API client that attaches request identity headers and bearer token when present (`apiClient.ts`).

Auth flow: login returns token/user, token is stored, and protected routes require `isAuthenticated` from store (`ProtectedRoute.tsx`). On `401`, client logs out and redirects to login. There is no token refresh flow implemented; expired tokens lead to re-authentication.

Realtime transport is not implemented as websocket/subscription architecture in this frontend. State refresh is request-driven via HTTP endpoints.

Role-based rendering in the strict RBAC sense is not a major pattern here; protected routing is auth-state based. Security enforcement still happens server-side via JWT verification middleware, so client-side checks are convenience only.

Error states are surfaced in UI with alert/status components and route redirection for auth failures.

## 9. CONCURRENCY AND EDGE CASES
For write operations, concurrent duplicate requests can happen. The backend has idempotency key generation for plan flows (`buildIdempotencyKey`, `buildDailyIdempotencyKey`, weekly idempotency key), backed by Redis or memory fallback. This reduces duplicate processing risk but behavior depends on cache availability and TTL semantics.

If the same request arrives twice quickly, cache/idempotency may short-circuit repeat computation. If the server crashes mid-request, no global exactly-once guarantee is present; retry behavior depends on endpoint and whether state mutation already occurred.

AAROGYA-specific edge cases directly represented in tests and code include: identical request determinism checks (`/plan/test-determinism`), reliability fallback with P0 safety assertions (multiple `testP0*`, `testFallback*` files), AI timeout/degraded handling (`mapErrorToStatus`, AI fallback paths), and empty/failed catalog fallback logging.

Stale read windows exist where in-memory fallback or non-transactional multi-step flows are used, so strict linearizability is not guaranteed system-wide.

## 10. RELIABILITY AND FAILURE HANDLING
Database failure: startup and runtime checks can place system in degraded mode unless `REQUIRE_DB=true`, where startup can fail-fast. In-flight DB-dependent operations return mapped errors. Health endpoint reports degraded checks rather than always 500.

External service failure: Redis failure falls back to in-memory cache with explicit mode/error tracking (`redis.service.js`). AI service failures map to degraded assistive behavior; deterministic core can continue if AI path is optional for that request.

Application failure: startup exceptions can exit process; graceful shutdown attempts to close HTTP server, Redis client, and DB pool. Memory exhaustion or process death recovery is external to app and depends on deployment supervisor.

Idempotency: `/plan`, `/plan/daily`, and `/weekly-plan` use deterministic hash keys and cache TTL. Not all write paths have full idempotency or transactional exactly-once guarantees.

## 11. SECURITY AND PRODUCTION BEST PRACTICES
Authentication uses JWT signed with `JWT_SECRET` and `expiresIn: "1h"` in login controller. Bearer token validation checks header format, token validity, and `userId` claim in middleware.

Authorization is endpoint-based. `/user/*` requires auth middleware. Planning endpoints are mostly optional-auth by design in current routes, so authorization granularity is limited for those APIs.

Input validation runs in multiple layers: frontend contract parsing, route-level AJV schemas, and request contract validators in backend. This catches malformed payloads early but does not replace all business-rule validation.

SQL injection protection relies on parameterized query usage in DB service patterns. XSS risk is reduced by React escaping defaults, but rendering unsafe HTML would still require strict sanitization if introduced. CSRF is partially mitigated by bearer token header pattern rather than cookie sessions, but token theft remains a key threat if local storage is compromised.

Secrets are environment-driven (`JWT_SECRET`, `DATABASE_URL`, service URLs). If `.env` leaks, immediate rotation of JWT secret, DB credentials, and any API keys is required; token invalidation follows secret rotation.

## 12. PERFORMANCE
Measured baseline available from repository workflows is partial. The `npm run verify` pipeline currently completes in about one minute on this environment and includes lint/build/tests/phase/smoke checks.

The code sets DB pool max to 10 by default (`PG_POOL_MAX` default in `pg.service.js`) and includes bounded query retry logic for transient errors. Optimizer complexity and candidate volume are likely the heaviest runtime path, and there are optimizer benchmark tests in suite.

Frontend bundle-size and time-to-first-meaningful-paint are not formally captured in committed scripts because the frontend build script currently runs type/no-direct-endpoint checks rather than full artifact reporting.

Operational slowness can be detected via metrics endpoints and telemetry routes rather than a dedicated APM integration in this repo.

## 13. SCALABILITY AND PRODUCTION THINKING
Current bottlenecks include single-process backend assumptions, memory fallback cache semantics, and mixed persistence architecture that needs careful coordination under horizontal scale.

Vertical scaling can improve throughput up to CPU/memory and DB connection boundaries. Horizontal scaling requires removing implicit single-instance assumptions, especially for in-memory fallback behaviors and consistent idempotency semantics.

Deployment artifacts in repo include `docker-compose.yml` and infrastructure SQL/migration scripts. Zero-downtime/rollback strategy is not fully codified in a dedicated deployment pipeline file in this repo, so that remains an operational gap.

Monitoring surfaces exist through `/health`, `/metrics`, and `/metrics/prometheus`; alerting policy definitions are not committed as code here.

## 14. TESTING
Backend test suite contains 74 test files under `apps/backend/tests`. The verify command runs lint, build checks, full test suites, extended tests, phase checks, and golden-path smoke (`package.json` root and backend).

Test coverage style is script-driven Node tests rather than a single test runner abstraction. This gives explicit control over scenario scripts (determinism, contracts, fallback, P0, optimizer, weekly planner) but makes exact normalized "test case count" harder to derive from framework metadata.

Most important regression classes covered include contract validation, determinism, reliability fallback, P0 constraint safety, API behavior, and trace integrity. Gaps remain in formal concurrency stress and full production-like distributed failure simulation.

## 15. KNOWN LIMITATIONS
A real limitation is the dual persistence shape across Prisma models and SQL-required startup tables, which increases migration coordination complexity.

Another limitation is degraded fallback behavior: the system can still return plans when DB/catalog paths degrade, but quality and persistence guarantees are reduced. Logs explicitly show fallback/degraded states.

Auth/session handling currently lacks refresh-token rotation; token expiry leads to re-login. This is simple and safe enough for initial scope but not ideal for long-lived sessions.

Frontend and backend observability exist, but full performance baselines and alert automation are not comprehensively encoded in this repository.

## 16. FUTURE IMPROVEMENTS
First, I would add integration tests that exercise weekly planning against seeded PostgreSQL fixtures and assert both request and response contract invariants across persistence mode boundaries.

Second, I would formalize stronger anti-repetition constraints for weekly plans at persistence and query layers, including deterministic uniqueness policy per user/week window.

Third, I would harden production operations with explicit alerting rules for sustained degraded mode signals (DB disabled, cache fallback, AI fallback) and enforce fail-fast policy by environment.

## 17. WHAT YOU WOULD DO DIFFERENTLY
I would reverse one architectural decision: I would not keep long-term dual persistence definitions split between evolving SQL catalogs and partially overlapping Prisma models without a unified migration contract.

I would change one technology choice in auth/session handling: I would add refresh-token flow with secure rotation policy instead of single short-lived access token only, because current UX and operational handling around expiry is coarse.

I under-engineered distributed consistency for fallback/cache/idempotency semantics under multi-instance deployment, and I over-engineered parts of route-level duplication where similar validation and response shaping could be standardized with shared abstractions.

The biggest learning is that deterministic safety and contract governance are strong foundations, but operational coherence across persistence, auth lifecycle, and scale assumptions must be designed as first-class concerns early.

## 18. THE NUMBERS
These values are directly derived from this repository state:

- API endpoints: 24 active route handlers (including `/auth/*`, `/user/*`, planning, assistant, decision actions, prakriti, health/metrics/logs).
- Database tables: 9 tables are explicitly required at startup validation for production-ready mode (`validateDbCatalog`), with additional Prisma-backed and recipe-related tables defined in schema/migrations.
- Test files: 74 backend test files in `apps/backend/tests`.
- Test cases: not centrally instrumented as a single framework count; suite is script-based Node tests.
- Approximate lines of code: backend source 16,944; frontend source 9,999; backend tests 6,391; combined ~33,334 LOC in this measurement.
- Real users/test sessions: no production user telemetry dataset is committed in repo; local/CI test execution is the primary evidence.
- Deployment status: local/dev deployment is fully supported; production target configuration is implied through env + infra scripts but not fully encoded as one-click IaC pipeline here.
- Build time: verify run observed around ~56-60 seconds in this environment.
- Bundle size: not currently reported by committed build scripts.
- Average API response time: not formally benchmarked as a committed baseline; health/metrics endpoints exist for runtime observation.

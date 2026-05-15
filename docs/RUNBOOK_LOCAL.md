# Local development runbook

**Strategic roadmap:** [MASTER_EXECUTION_PLAN.md](MASTER_EXECUTION_PLAN.md) · **Deploy:** [DEPLOYMENT.md](DEPLOYMENT.md)

This runbook matches the **golden path** exercised in CI: catalog fallbacks (no PostgreSQL), then optional full stack with database.

## 1. Prerequisites

- Node.js 20+ (matches CI)
- npm 9+
- Optional: PostgreSQL 14+ for auth, history, adherence, and DB-backed catalogs
- Optional: Redis for idempotency cache on `/plan`
- Optional: Python 3.11+ for `apps/ai-service` (FastAPI)

## 2. Install

From the repository root:

```bash
npm ci
```

## 2.1 One-command dev (Phase 0.3)

**Frontend + backend together** (from repo root):

```bash
npm run dev
```

This runs `apps/backend` (nodemon, default **http://localhost:5000**) and `apps/frontend` (Vite, **http://localhost:5173**) in parallel. Stop with Ctrl+C (both processes exit together).

**Postgres + Redis** (optional; for DB-backed catalogs and `/plan` idempotency cache):

```bash
docker compose up -d
```

Then set `apps/backend/.env`, for example:

- `DATABASE_URL=postgresql://aarogya:aarogya_local@localhost:5432/aarogya` (matches [docker-compose.yml](../docker-compose.yml))
- `REDIS_URL=redis://127.0.0.1:6379`
- `USE_REDIS=true`

**Prometheus + Grafana (optional Phase 3 telemetry)** — scrapes the backend on the host at `http://host.docker.internal:5000/metrics/prometheus`. Start the backend first (`npm run dev` or `npm run start` in `apps/backend`), then:

```bash
docker compose --profile telemetry up -d
```

- Prometheus UI: **http://localhost:9090**
- Grafana: **http://localhost:3001** (default login `admin` / `admin`; change in production)

Apply migrations when using Postgres: `cd apps/backend && npx prisma migrate deploy`.

On Unix (or Git Bash), `make dev` / `make up` mirror the same commands.

## 3. Backend environment

Copy [apps/backend/.env.example](apps/backend/.env.example) to `apps/backend/.env` (and/or repo root `.env`).

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL; omit for **degraded** mode (JSON fallbacks for foods/rules/templates). |
| `REQUIRE_DB` | Set to `true` in staging/production to **fail fast** if DB or catalogs are missing. |
| `JWT_SECRET` | Required for **auth** (`/auth/*`, `/user/*`). Plan APIs work without it. |
| `CORS_ORIGINS` | Required in production; for local Vite use `http://localhost:5173`. |

## 4. Database and Prisma (optional but recommended for auth)

```bash
cd apps/backend
npx prisma migrate deploy
```

Ensure SQL catalog tables exist and are populated per your deployment (see server startup validation when `REQUIRE_DB=true`).

## 5. Golden path smoke (no HTTP server)

Validates **DecisionRequest → orchestrator → meal_plan + Trace_v1** using JSON fallbacks:

```bash
npm run golden-path-smoke
```

## 6. Run backend API

From repo root you can use **`npm run dev`** (backend + frontend together; see §2.1). To run the API only:

```bash
cd apps/backend
npm run dev
```

Smoke checks:

- `GET http://localhost:5000/health`
- `POST http://localhost:5000/plan` with a `DecisionRequest_v1` body (see contract schemas under `apps/backend/src/contracts/schemas/`).
- **Graceful shutdown (Phase 4):** stopping the Node process with **Ctrl+C** (or `SIGTERM`) closes the HTTP server, Redis client, PostgreSQL pool, and flushes Pino logs before exit.

## 7. Run frontend

From repo root you can use **`npm run dev`** (see §2.1). To run Vite only:

```bash
cd apps/frontend
npm run dev
```

Copy [apps/frontend/.env.example](apps/frontend/.env.example) if you need to disable dashboard telemetry.

## 8. Run AI service (optional)

```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Point backend env vars (`AI_SERVICE_URL`, RAG URLs, etc.) at this instance.

## 9. Tests (same as CI)

From repo root:

```bash
npm run verify
```

Equivalent step-by-step:

```bash
npm run lint
npm run build
npm run test:all
npm run test:extended
npm --prefix apps/backend run test:phase1
npm run golden-path-smoke
```

Which tests map to which tier: [TESTS_INVENTORY.md](TESTS_INVENTORY.md).

## 10. Product flow (demo narrative)

1. **Onboard** — capture user context in the app (stored via Prisma when DB + auth configured).
2. **Planner** — build `DecisionRequest_v1` and call `POST /plan` (or use the UI).
3. **Trace** — inspect `trace` on `DecisionResponse_v1` or use the in-app trace view.

For interview framing, describe the system as **deterministic core first**, optional **assistive AI**, and **contract-validated** boundaries (see [docs/PRD.md](PRD.md)).

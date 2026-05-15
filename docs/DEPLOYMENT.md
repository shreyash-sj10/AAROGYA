# Deployment checklist (AAROGYA)

High-level guide for taking the monorepo from **local** to **hosted**. Adjust for your provider (Fly.io, Render, Railway, AWS, VPS + Docker).

## 1. Services to run

| Service | Role |
|---------|------|
| **Backend** | Node: `apps/backend` — `npm run start` (set `NODE_ENV=production`). |
| **Frontend** | Static build: `apps/frontend` — `npm run build` → serve `dist/` behind CDN or static host. |
| **PostgreSQL** | Prisma + raw SQL catalogs; migrations: `npx prisma migrate deploy` in `apps/backend`. |
| **Redis** (optional) | Idempotency cache for `/plan`; set `USE_REDIS=true`, `REDIS_URL`. |
| **AI service** (optional) | Python FastAPI: `apps/ai-service` — separate process; point backend env URLs. |

## 2. Required environment variables

### Backend

- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — strong secret for auth.
- `CORS_ORIGINS` — comma-separated allowed web origins (**required** in production).
- `REQUIRE_DB=true` — recommended in production (fail if DB/catalogs missing).
- Optional: `REDIS_URL`, `USE_REDIS`, AI/RAG URLs, timeouts (see `apps/backend/.env.example`).

### Frontend

- `VITE_API_BASE_URL` — public URL of the backend API (must match CORS).

## 3. Build & release steps

1. **Install:** `npm ci` at repo root (workspaces).
2. **Prisma:** `cd apps/backend && npx prisma migrate deploy && npx prisma generate` (generate also runs via `postinstall` on install).
3. **Seed / catalog:** Ensure `food_catalog`, `rule_catalog`, `meal_templates` populated (see server startup validation when `REQUIRE_DB=true`).
4. **Backend:** run `node src/server.js` or process manager (PM2, systemd).
5. **Frontend:** `npm run build` in `apps/frontend`; deploy `dist/`.

## 4. Health checks

- Use `GET /health` for load balancers once **health semantics** are aligned with degraded-DB policy (see [MASTER_EXECUTION_PLAN.md](MASTER_EXECUTION_PLAN.md) Phase 0.1).
- Add synthetic **`POST /plan`** smoke with a tiny golden `DecisionRequest_v1` after deploy.

## 5. Security

- HTTPS only in production; never commit `.env`.
- Rotate secrets if leaked; restrict DB network to app hosts.

## 6. Future: Docker Compose

For local parity and demos, a single `docker-compose.yml` (Postgres + Redis + backend + frontend + optional ai-service) is tracked in [MASTER_EXECUTION_PLAN.md](MASTER_EXECUTION_PLAN.md) Phase 0.3.

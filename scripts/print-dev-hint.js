/* eslint-disable no-console */
console.log(`
[AAROGYA] Dev servers
  Backend   → http://localhost:5000
  Frontend  → http://localhost:5173

Optional: docker compose up -d   (Postgres + Redis — see docs/RUNBOOK_LOCAL.md)
Env:       apps/backend/.env from apps/backend/.env.example
Ports:     predev frees 5000/5001; use ONE dev entry (root OR apps/backend), not both.
           Stuck? cd apps/backend && npm run dev:kill-ports
Optional AI: cd apps/ai-service && uvicorn main:app --reload --port 8000
`);

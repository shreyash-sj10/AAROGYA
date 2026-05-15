# AAROGYA

Deterministic, contract-first meal recommendation engine that combines Ayurveda-informed constraints with modern nutrition scoring.

## What This Repository Contains

AAROGYA currently implements a food-level deterministic pipeline and is transitioning to a recipe-level architecture (`RecipeAggregate_v1`) under the 3.1 foundation lock.

Current runtime pipeline:

`UserState -> Template -> Candidates -> Constraint Engine -> Scoring -> Diversity -> Optimizer -> Reliability -> Explanation`

## Core Principles

- Contract-first boundaries between AI, Core, API, and internal modules
- Deterministic behavior for repeatable outputs
- Safety-first filtering (allergies, diet, high-priority rule rejects)
- Explainability through traceable rule and score breakdowns

## Project Status

- `3.0 Contract Layer`: Locked (versioning, validation, trace propagation, confidence and error contracts)
- `3.1 Recipe Foundation`: Designed and locked; implementation in progress
- Current engine unit: `Food`
- Target engine unit: `RecipeAggregate_v1`

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Contracts](docs/CONTRACTS.md)
- [Roadmap](docs/ROADMAP.md)

## Repository structure (monorepo)

```text
AAROGYA/
  apps/
    backend/          # Express API, Prisma, deterministic pipeline (canonical)
    frontend/         # Vite + React client
    ai-service/       # Optional FastAPI assistive layer
  docs/               # PRD, architecture, execution plan, test inventory
  infrastructure/     # SQL migrations, load scripts
  docker-compose.yml  # Local Postgres + Redis
  package.json        # npm workspaces + verify / dev scripts
```

Legacy **`db/schema.sql`** may still exist for reference; **Prisma** and **`infrastructure/db/`** are the persistence sources of truth for new work.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm ci
```

### Monorepo dev (backend + frontend)

From the repository root:

```bash
npm run dev
```

Runs the API (default [http://localhost:5000](http://localhost:5000)) and Vite ([http://localhost:5173](http://localhost:5173)) together. Optional Postgres/Redis: `docker compose up -d`. Full steps and env vars: [docs/RUNBOOK_LOCAL.md](docs/RUNBOOK_LOCAL.md).

### Match CI locally

```bash
npm run verify
```

### Legacy per-package scripts (optional)

From `apps/backend` only (not defined at repo root):

```bash
cd apps/backend
npm run test:food
npm run test:pipeline
npm run test:system
```

### Run all current tests (sequential)

```bash
npm run test:all
```

## Key modules (backend)

- `apps/backend/src/modules/food`: food schema validation + sample loading (AJV)
- `apps/backend/src/modules/rules`: deterministic rule evaluation and filtering
- `apps/backend/src/modules/candidate`: candidate generation + prefilters
- `apps/backend/src/modules/scoring`: nutrition/dosha/digestibility/familiarity scoring
- `apps/backend/src/modules/diversity`: repetition penalty handling
- `apps/backend/src/modules/optimizer`: combinational meal optimization
- `apps/backend/src/modules/reliability`: constraint relaxation + confidence computation
- `apps/backend/src/modules/explanation`: user-facing explanation generation
- `apps/backend/src/core/pipeline`: orchestrated end-to-end flow

## Contracts and Governance

This project follows immutable versioned contracts:

- `AIProfileOutput_v1`
- `RecipeAggregate_v1`
- `DecisionRequest_v1`
- `DecisionResponse_v1`
- `Trace_v1`
- `Confidence_v1`
- `ErrorResponse_v1`

Every contract includes:

- `version`
- `schema_version`
- `compatibility`

Breaking changes require `_v2`.

See [docs/MASTER_EXECUTION_PLAN.md](docs/MASTER_EXECUTION_PLAN.md) and [docs/TESTS_INVENTORY.md](docs/TESTS_INVENTORY.md).

## Database

Primary SQL evolution: **`apps/backend/prisma/`** and **`infrastructure/db/`**. Legacy **`db/schema.sql`** may exist for reference only.

## Notes for Contributors

- Prefer canonical files over deprecated wrappers:
  - Use `candidateGenerator.js` over `candidate.generator.js`
  - Use `scoringEngine.js` over `scoring.engine.js`
  - Use `optimizer.js` over `meal.optimizer.js`
- Keep module IO explicit and schema-validated at boundaries
- Avoid nondeterministic randomness in scoring/selection

## License

Internal / proprietary unless explicitly specified.

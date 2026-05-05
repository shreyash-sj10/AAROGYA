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

## Repository Structure

```text
AAROGYA/
  db/
    schema.sql
  docs/
    ARCHITECTURE.md
    CONTRACTS.md
    ROADMAP.md
  src/
    config/
    modules/
      candidate/
      diversity/
      explanation/
      food/
      optimizer/
      reliability/
      rules/
      scoring/
      templates/
      userState/
    pipeline/
    services/
    utils/
  test*.js
  package.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run smoke tests

```bash
npm run test:food
npm run test:pipeline
npm run test:system
```

### Run all current tests (sequential)

```bash
npm run test:all
```

## Key Modules

- `src/modules/food`: food schema validation + sample loading (AJV)
- `src/modules/rules`: deterministic rule evaluation and filtering
- `src/modules/candidate`: candidate generation + prefilters
- `src/modules/scoring`: nutrition/dosha/digestibility/familiarity scoring
- `src/modules/diversity`: repetition penalty handling
- `src/modules/optimizer`: combinational meal optimization
- `src/modules/reliability`: constraint relaxation + confidence computation
- `src/modules/explanation`: user-facing explanation generation
- `src/pipeline`: orchestrated end-to-end flow

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

## Database

Current SQL schema is in [db/schema.sql](db/schema.sql).

3.1 introduces recipe-first tables (`recipes`, `recipe_ingredients`, `recipe_aggregates`) with precomputed aggregates for deterministic and performant runtime scoring.

## Notes for Contributors

- Prefer canonical files over deprecated wrappers:
  - Use `candidateGenerator.js` over `candidate.generator.js`
  - Use `scoringEngine.js` over `scoring.engine.js`
  - Use `optimizer.js` over `meal.optimizer.js`
- Keep module IO explicit and schema-validated at boundaries
- Avoid nondeterministic randomness in scoring/selection

## License

Internal / proprietary unless explicitly specified.

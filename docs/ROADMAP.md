# Roadmap

**SDE flagship execution:** see [MASTER_EXECUTION_PLAN.md](MASTER_EXECUTION_PLAN.md) (phases 0–8: stabilization → safety → trace UX → ops → transactions → recipe-first → scale → UI → deploy).

## Stage Snapshot

- `Stage 3.0`: Contract system hard-locked
- `Stage 3.1`: Recipe system foundation designed and locked
- `Current implementation`: food-level deterministic pipeline with reliability fallback

## Completed

- Deterministic pipeline orchestration
- Rule engine with priority-aware reject/penalize flow
- Candidate, scoring, diversity, optimizer modules
- Reliability layer with controlled relaxation
- Explanation generation
- AJV-backed food schema validation

## In Progress

- Migration from `Food` unit to `RecipeAggregate_v1`
- Recipe tables and precomputed aggregate cache
- Contract-conformant DecisionRequest/DecisionResponse wrappers

## Next Execution Order

1. Add recipe data model (`recipes`, `recipe_ingredients`, `recipe_aggregates`)
2. Implement aggregation engine for `RecipeAggregate_v1`
3. Switch candidate generation input from foods to recipes
4. Update constraint engine for dual checks (ingredient + aggregate)
5. Wire scoring engine to `recipe.aggregates.nutrition`
6. Keep optimizer logic and update input combinations to recipes
7. Emit contract-valid `DecisionResponse_v1`, `Trace_v1`, and `ErrorResponse_v1`
8. Add strict AJV schemas for all 3.0 contracts and boundary validators

## Non-Negotiables

- Immutable contract versions
- Deterministic output for same input
- No free-text in controlled enums/vocab IDs
- Schema validation at every system boundary

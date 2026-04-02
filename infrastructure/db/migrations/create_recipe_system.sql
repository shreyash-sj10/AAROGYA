BEGIN;

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('carb', 'protein', 'vegetable', 'fat', 'composite')),
    cuisine TEXT,
    is_vegetarian BOOLEAN,
    default_serving_size_grams INT NOT NULL,
    recipe_version INT DEFAULT 1,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id TEXT REFERENCES recipes(id),
    food_id TEXT REFERENCES foods(id),
    quantity_grams INT NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS recipe_aggregates (
    recipe_id TEXT PRIMARY KEY REFERENCES recipes(id),
    version TEXT NOT NULL,
    schema_version INT NOT NULL,
    compatibility TEXT NOT NULL,
    aggregation_basis TEXT CHECK (aggregation_basis IN ('per_serving')),
    calories FLOAT,
    protein FLOAT,
    carbs FLOAT,
    fat FLOAT,
    glycemic_index FLOAT,
    vata_effect FLOAT,
    pitta_effect FLOAT,
    kapha_effect FLOAT,
    digestibility_score FLOAT,
    heaviness_score FLOAT,
    computed_at TIMESTAMP,
    source_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
ON recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_aggregates_recipe_id
ON recipe_aggregates(recipe_id);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    age INT NOT NULL CHECK (age > 0 AND age < 130),
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    diet_type TEXT CHECK (diet_type IS NULL OR diet_type IN ('veg', 'non_veg', 'vegan', 'eggetarian')),
    vata DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (vata >= 0.0 AND vata <= 1.0),
    pitta DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (pitta >= 0.0 AND pitta <= 1.0),
    kapha DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (kapha >= 0.0 AND kapha <= 1.0),
    agni_strength DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (agni_strength >= 0.0 AND agni_strength <= 1.0),
    conditions TEXT[] NOT NULL DEFAULT '{}',
    allergies TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_prakriti_sum CHECK (abs((vata + pitta + kapha) - 1.0) < 0.3)
);

CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    rasa TEXT[] NOT NULL DEFAULT '{}',
    guna TEXT[] NOT NULL DEFAULT '{}',
    virya TEXT,
    vipaka TEXT,
    vata_effect DOUBLE PRECISION NOT NULL CHECK (vata_effect >= -1.0 AND vata_effect <= 1.0),
    pitta_effect DOUBLE PRECISION NOT NULL CHECK (pitta_effect >= -1.0 AND pitta_effect <= 1.0),
    kapha_effect DOUBLE PRECISION NOT NULL CHECK (kapha_effect >= -1.0 AND kapha_effect <= 1.0),
    digestibility_score DOUBLE PRECISION NOT NULL CHECK (digestibility_score >= 0.0 AND digestibility_score <= 1.0),
    heaviness_score DOUBLE PRECISION NOT NULL CHECK (heaviness_score >= 0.0 AND heaviness_score <= 1.0),
    nutrition JSONB NOT NULL,
    seasonality TEXT[] NOT NULL DEFAULT '{}',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_food_category CHECK (category IN ('grain', 'dal', 'vegetable', 'fruit', 'dairy', 'spice')),
    CONSTRAINT chk_food_virya CHECK (virya IS NULL OR virya IN ('hot', 'cold')),
    CONSTRAINT chk_food_vipaka CHECK (vipaka IS NULL OR vipaka IN ('sweet', 'sour', 'pungent')),
    CONSTRAINT chk_food_nutrition_object CHECK (jsonb_typeof(nutrition) = 'object'),
    CONSTRAINT chk_food_meta_object CHECK (jsonb_typeof(meta) = 'object'),
    CONSTRAINT chk_food_nutrition_required_keys CHECK (
        nutrition ? 'calories'
        AND nutrition ? 'protein'
        AND nutrition ? 'carbs'
        AND nutrition ? 'fat'
        AND nutrition ? 'glycemic_index'
    ),
    CONSTRAINT chk_food_nutrition_ranges CHECK (
        (nutrition->>'calories')::numeric >= 0
        AND (nutrition->>'protein')::numeric >= 0
        AND (nutrition->>'carbs')::numeric >= 0
        AND (nutrition->>'fat')::numeric >= 0
        AND (nutrition->>'glycemic_index')::numeric >= 0
        AND (nutrition->>'glycemic_index')::numeric <= 100
    )
);

CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    logic_tree JSONB NOT NULL,
    action JSONB NOT NULL,
    citation TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rules_logic_tree_object CHECK (jsonb_typeof(logic_tree) = 'object'),
    CONSTRAINT chk_rules_action_object CHECK (jsonb_typeof(action) = 'object'),
    CONSTRAINT chk_rules_logic_tree_required_keys CHECK (
        logic_tree ? 'logic' AND logic_tree ? 'conditions'
    ),
    CONSTRAINT chk_rules_action_required_keys CHECK (
        action ? 'type'
    ),
    CONSTRAINT chk_rules_action_type CHECK (
        action->>'type' IN ('reject', 'penalize')
    )
);

CREATE TABLE IF NOT EXISTS meal_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    cuisine TEXT,
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_meal_templates_tags_object CHECK (jsonb_typeof(tags) = 'object')
);

CREATE TABLE IF NOT EXISTS meal_slots (
    id SERIAL PRIMARY KEY,
    template_id INT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
    slot_type TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_categories TEXT[] NOT NULL DEFAULT '{}',
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_meal_slots_constraints_object CHECK (jsonb_typeof(constraints) = 'object')
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan JSONB NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_meal_plans_plan_object CHECK (jsonb_typeof(plan) = 'object')
);

CREATE TABLE IF NOT EXISTS user_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_plan_id INT REFERENCES meal_plans(id) ON DELETE SET NULL,
    feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_history_feedback_object CHECK (jsonb_typeof(feedback) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_food_category ON foods(category);
CREATE INDEX IF NOT EXISTS idx_food_pitta ON foods(pitta_effect);
CREATE INDEX IF NOT EXISTS idx_food_digestibility ON foods(digestibility_score);
CREATE INDEX IF NOT EXISTS idx_food_heaviness ON foods(heaviness_score);
CREATE INDEX IF NOT EXISTS idx_food_virya ON foods(virya);
CREATE INDEX IF NOT EXISTS idx_food_created_at ON foods(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON rules(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_rules_logic_tree_gin ON rules USING GIN (logic_tree jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_rules_action_gin ON rules USING GIN (action jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_food_gi_numeric
ON foods (((nutrition->>'glycemic_index')::numeric));

CREATE INDEX IF NOT EXISTS idx_food_category_gi
ON foods(category, ((nutrition->>'glycemic_index')::numeric));

CREATE INDEX IF NOT EXISTS idx_food_rasa_gin ON foods USING GIN (rasa);
CREATE INDEX IF NOT EXISTS idx_food_guna_gin ON foods USING GIN (guna);
CREATE INDEX IF NOT EXISTS idx_food_seasonality_gin ON foods USING GIN (seasonality);
CREATE INDEX IF NOT EXISTS idx_food_meta_gin ON foods USING GIN (meta jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_user_conditions_gin ON users USING GIN (conditions);
CREATE INDEX IF NOT EXISTS idx_user_allergies_gin ON users USING GIN (allergies);
CREATE INDEX IF NOT EXISTS idx_user_created_at ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_templates_meal_type ON meal_templates(meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_slots_template_id ON meal_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_meal_slots_allowed_categories_gin ON meal_slots USING GIN (allowed_categories);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id_created_at ON meal_plans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_history_user_id_created_at ON user_history(user_id, created_at DESC);

COMMIT;

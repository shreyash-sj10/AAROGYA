require("dotenv").config();

const { query, isDbEnabled } = require("../src/services/db/pg.service");
const { sampleFoods } = require("../src/modules/food/food.samples");
const sampleRules = require("../src/rules/engine/rule.samples");
const sampleTemplates = require("../src/templates/mealTemplates.json");

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function ensureTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS preferences (
      user_id TEXT PRIMARY KEY,
      weights JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_state (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS weekly_plans (
      user_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, week_id)
    );

    CREATE TABLE IF NOT EXISTS food_catalog (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rule_catalog (
      id TEXT PRIMARY KEY,
      priority TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meal_templates (
      id TEXT PRIMARY KEY,
      meal_type TEXT NOT NULL,
      priority INT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS decision_logs (
      request_id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      request_payload JSONB NOT NULL,
      response_payload JSONB NOT NULL,
      execution_trace JSONB NOT NULL,
      safe_trace JSONB NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_decision_logs_trace_id ON decision_logs(trace_id);
    CREATE INDEX IF NOT EXISTS idx_decision_logs_timestamp ON decision_logs(timestamp);

    CREATE TABLE IF NOT EXISTS user_meal_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      meal_id TEXT NOT NULL,
      category TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_meal_history_user_time
      ON user_meal_history(user_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS user_weekly_adherence (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      adherence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      stats JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_weekly_adherence_user_week
      ON user_weekly_adherence(user_id, week_id);

    CREATE INDEX IF NOT EXISTS idx_user_weekly_adherence_user_week
      ON user_weekly_adherence(user_id, week_id);
  `;

  await query(sql);
}

async function seedFoodCatalog(limit = 20) {
  const foods = toSafeArray(sampleFoods).slice(0, Math.max(10, limit));

  for (const food of foods) {
    const id = String(food.id || food.recipe_id || "").trim();
    if (!id) {
      continue;
    }

    await query(
      [
        "INSERT INTO food_catalog (id, payload, updated_at)",
        "VALUES ($1, $2::jsonb, NOW())",
        "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      ].join(" "),
      [id, JSON.stringify(food)]
    );
  }

  return foods.length;
}

async function seedRuleCatalog() {
  const rules = toSafeArray(sampleRules);

  for (const rule of rules) {
    const id = String(rule.id || "").trim();
    const priority = String(rule.priority || "P2").trim();
    if (!id) {
      continue;
    }

    await query(
      [
        "INSERT INTO rule_catalog (id, priority, payload, updated_at)",
        "VALUES ($1, $2, $3::jsonb, NOW())",
        "ON CONFLICT (id) DO UPDATE SET priority = EXCLUDED.priority, payload = EXCLUDED.payload, updated_at = NOW()",
      ].join(" "),
      [id, priority, JSON.stringify(rule)]
    );
  }

  return rules.length;
}

async function seedTemplateCatalog() {
  const templates = toSafeArray(sampleTemplates);

  for (const template of templates) {
    const id = String(template.id || template.template_id || "").trim();
    const mealType = String(template.meal_type || "lunch").trim();
    const priority = Number.isFinite(Number(template.priority)) ? Number(template.priority) : 1;
    if (!id) {
      continue;
    }

    await query(
      [
        "INSERT INTO meal_templates (id, meal_type, priority, payload, updated_at)",
        "VALUES ($1, $2, $3, $4::jsonb, NOW())",
        "ON CONFLICT (id) DO UPDATE SET meal_type = EXCLUDED.meal_type, priority = EXCLUDED.priority, payload = EXCLUDED.payload, updated_at = NOW()",
      ].join(" "),
      [id, mealType, priority, JSON.stringify(template)]
    );
  }

  return templates.length;
}

async function migrate() {
  if (!isDbEnabled()) {
    console.error("DB is not enabled. Skipping migration.");
    process.exit(0);
  }

  try {
    console.log("Starting migration: creating AAROGYA data-layer tables...");
    await ensureTables();
    console.log("Table creation complete.");

    const foodCount = await seedFoodCatalog(20);
    const ruleCount = await seedRuleCatalog();
    const templateCount = await seedTemplateCatalog();

    console.log(`Seed complete: foods=${foodCount}, rules=${ruleCount}, templates=${templateCount}`);
    console.log("Migration successful: AAROGYA data-layer tables are ready.");
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

migrate();

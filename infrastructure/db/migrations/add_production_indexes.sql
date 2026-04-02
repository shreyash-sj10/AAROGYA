CREATE INDEX IF NOT EXISTS idx_foods_id ON foods(id);
CREATE INDEX IF NOT EXISTS idx_recipes_id ON recipes(id);
CREATE INDEX IF NOT EXISTS idx_user_daily_state_user_id_date ON user_daily_state(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);

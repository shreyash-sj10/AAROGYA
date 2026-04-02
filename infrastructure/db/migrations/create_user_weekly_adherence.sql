BEGIN;

CREATE TABLE IF NOT EXISTS user_weekly_adherence (
    user_id TEXT NOT NULL,
    week_id TEXT NOT NULL,
    adherence_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (adherence_score >= 0 AND adherence_score <= 1),
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, week_id),
    CONSTRAINT chk_user_weekly_adherence_stats_object CHECK (jsonb_typeof(stats) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_user_weekly_adherence_user_week ON user_weekly_adherence(user_id, week_id);

COMMIT;

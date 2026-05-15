CREATE TABLE IF NOT EXISTS "public"."user_weekly_adherence" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "adherence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_weekly_adherence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_weekly_adherence_user_week"
ON "public"."user_weekly_adherence"("user_id", "week_id");

CREATE INDEX IF NOT EXISTS "idx_user_weekly_adherence_user_week"
ON "public"."user_weekly_adherence"("user_id", "week_id");

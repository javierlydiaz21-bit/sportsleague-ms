-- CreateTable
CREATE TABLE "attendance_estimates" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "estimated_attendance" INTEGER NOT NULL,

    CONSTRAINT "attendance_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspended_matches" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "suspended_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_performance_trend" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "match_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "trend_metric" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "team_performance_trend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_runs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "errors" TEXT[],

    CONSTRAINT "etl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_estimates_match_id_key" ON "attendance_estimates"("match_id");

-- CreateIndex
CREATE INDEX "attendance_estimates_season_id_idx" ON "attendance_estimates"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "suspended_matches_match_id_key" ON "suspended_matches"("match_id");

-- CreateIndex
CREATE INDEX "suspended_matches_season_id_idx" ON "suspended_matches"("season_id");

-- CreateIndex
CREATE INDEX "team_performance_trend_team_id_season_id_idx" ON "team_performance_trend"("team_id", "season_id");


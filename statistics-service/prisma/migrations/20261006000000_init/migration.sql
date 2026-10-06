-- CreateTable
CREATE TABLE "standings" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "goal_difference" INTEGER NOT NULL,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_scorers" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "goals" INTEGER NOT NULL,

    CONSTRAINT "top_scorers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_records" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "yellow_cards" INTEGER NOT NULL,
    "red_cards" INTEGER NOT NULL,

    CONSTRAINT "disciplinary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "match_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "home_team" INTEGER NOT NULL,
    "away_team" INTEGER NOT NULL,
    "home_goals" INTEGER NOT NULL,
    "away_goals" INTEGER NOT NULL,
    "home_points" INTEGER,
    "away_points" INTEGER,
    "completed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "match_result_events" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "player_id" INTEGER,

    CONSTRAINT "match_result_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standings_season_id_team_id_key" ON "standings"("season_id", "team_id");

-- CreateIndex
CREATE INDEX "top_scorers_season_id_goals_idx" ON "top_scorers"("season_id", "goals");

-- CreateIndex
CREATE UNIQUE INDEX "top_scorers_season_id_player_id_key" ON "top_scorers"("season_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinary_records_player_id_key" ON "disciplinary_records"("player_id");

-- CreateIndex
CREATE INDEX "match_results_season_id_idx" ON "match_results"("season_id");

-- CreateIndex
CREATE INDEX "match_result_events_match_id_idx" ON "match_result_events"("match_id");

-- CreateIndex
CREATE INDEX "match_result_events_player_id_idx" ON "match_result_events"("player_id");

-- AddForeignKey
ALTER TABLE "match_result_events" ADD CONSTRAINT "match_result_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match_results"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restriccion (3.6): goals en top_scorers no puede ser negativo
ALTER TABLE "top_scorers" ADD CONSTRAINT "top_scorers_goals_check" CHECK ("goals" >= 0);

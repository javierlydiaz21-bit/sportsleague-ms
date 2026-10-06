-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('gol', 'tarjeta_amarilla', 'tarjeta_roja', 'sustitucion');

-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('programado', 'en_curso', 'finalizado', 'suspendido');

-- CreateTable
CREATE TABLE "match_events" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "type" "EventType" NOT NULL,
    "player_id" INTEGER,
    "team_id" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_matches" (
    "match_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "home_team" INTEGER NOT NULL,
    "away_team" INTEGER NOT NULL,
    "status" "LiveStatus" NOT NULL DEFAULT 'programado',
    "suspension_reason" TEXT,
    "peak_viewers" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "live_matches_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE INDEX "match_events_match_id_idx" ON "match_events"("match_id");

-- CreateIndex
CREATE INDEX "match_events_match_id_minute_idx" ON "match_events"("match_id", "minute");

-- CreateIndex
CREATE INDEX "live_matches_status_idx" ON "live_matches"("status");


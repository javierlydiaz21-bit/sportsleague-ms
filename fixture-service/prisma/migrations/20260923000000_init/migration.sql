-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('programado', 'en_curso', 'finalizado', 'suspendido');

-- CreateTable
CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "home_team" INTEGER NOT NULL,
    "away_team" INTEGER NOT NULL,
    "venue" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'programado',

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_season_id_scheduled_at_idx" ON "matches"("season_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

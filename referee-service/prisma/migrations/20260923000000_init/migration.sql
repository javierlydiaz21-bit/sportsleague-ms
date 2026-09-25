-- CreateTable
CREATE TABLE "referees" (
    "id" SERIAL NOT NULL,
    "zone" TEXT NOT NULL,
    "categories_certified" INTEGER[],
    "availability" TEXT[],

    CONSTRAINT "referees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referee_assignments" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "referee_id" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "referee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referees_zone_idx" ON "referees"("zone");

-- CreateIndex
CREATE INDEX "referee_assignments_match_id_idx" ON "referee_assignments"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "referee_assignments_match_id_referee_id_key" ON "referee_assignments"("match_id", "referee_id");

-- AddForeignKey
ALTER TABLE "referee_assignments" ADD CONSTRAINT "referee_assignments_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "referees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

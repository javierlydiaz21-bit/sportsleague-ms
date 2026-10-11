-- Propietario de cada liga: el usuario del API Gateway que la creo.
-- Solo agrega una columna opcional: las ligas existentes quedan sin propietario (NULL)
-- y no se modifica ningun otro dato.

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN     "owner_id" INTEGER;

-- CreateIndex
CREATE INDEX "leagues_owner_id_idx" ON "leagues"("owner_id");

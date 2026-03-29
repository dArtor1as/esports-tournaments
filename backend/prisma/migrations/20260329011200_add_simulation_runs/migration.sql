-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "algorithmType" TEXT NOT NULL,
    "populations" INTEGER NOT NULL,
    "generations" INTEGER NOT NULL,
    "fitnessScore" DOUBLE PRECISION NOT NULL,
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SimulationRun_tournamentId_fkey"
      FOREIGN KEY ("tournamentId")
      REFERENCES "Tournament"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SimulationRun_tournamentId_idx" ON "SimulationRun"("tournamentId");

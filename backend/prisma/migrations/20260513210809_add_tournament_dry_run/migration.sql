-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "isDryRun" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "predictedData" JSONB;

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'REPORTED', 'DISPUTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "matchStatus" "MatchStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reportedById" TEXT,
ADD COLUMN     "reportedScoreA" INTEGER,
ADD COLUMN     "reportedScoreB" INTEGER;

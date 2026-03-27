/*
  Warnings:

  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'DISBANDED');

-- CreateEnum
CREATE TYPE "Bracket" AS ENUM ('UPPER', 'LOWER', 'GRAND_FINAL', 'NONE');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('EU', 'NA', 'CIS', 'ASIA', 'SA', 'GLOBAL');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('TEAM', 'SOLO');

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_teamAId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_teamBId_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bestOf" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "bracket" "Bracket" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "nextMatchLoserId" TEXT,
ADD COLUMN     "nextMatchWinnerId" TEXT,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "teamAId" DROP NOT NULL,
ALTER COLUMN "teamBId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "region" "Region" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "format" "TournamentFormat" NOT NULL DEFAULT 'TEAM',
ADD COLUMN     "maxParticipants" INTEGER NOT NULL DEFAULT 16,
ADD COLUMN     "region" "Region" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "TournamentParticipant" ADD COLUMN     "groupPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mapsLost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mapsWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "matchesLost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "matchesWon" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Invitation";

-- CreateTable
CREATE TABLE "TournamentInvitation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentInvitation_token_key" ON "TournamentInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_token_key" ON "TeamInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_teamId_userId_key" ON "TeamInvitation"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchWinnerId_fkey" FOREIGN KEY ("nextMatchWinnerId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchLoserId_fkey" FOREIGN KEY ("nextMatchLoserId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

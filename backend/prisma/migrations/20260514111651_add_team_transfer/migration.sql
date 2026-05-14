-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('JOIN', 'LEAVE', 'KICK');

-- CreateTable
CREATE TABLE "TeamTransfer" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamTransfer_playerId_idx" ON "TeamTransfer"("playerId");

-- CreateIndex
CREATE INDEX "TeamTransfer_teamId_idx" ON "TeamTransfer"("teamId");

-- AddForeignKey
ALTER TABLE "TeamTransfer" ADD CONSTRAINT "TeamTransfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamTransfer" ADD CONSTRAINT "TeamTransfer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

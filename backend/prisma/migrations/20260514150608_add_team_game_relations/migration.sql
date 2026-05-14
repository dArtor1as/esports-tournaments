/*
  Warnings:

  - A unique constraint covering the columns `[name,gameId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tag,gameId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gameId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "gameId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_gameId_key" ON "Team"("name", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tag_gameId_key" ON "Team"("tag", "gameId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

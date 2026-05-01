/*
  Warnings:

  - Added the required column `creatorId` to the `Tournament` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "creatorId" TEXT NOT NULL,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

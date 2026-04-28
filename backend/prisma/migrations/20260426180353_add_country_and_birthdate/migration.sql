-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'INT',
ADD COLUMN     "isManualCountry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "countryCode" TEXT;

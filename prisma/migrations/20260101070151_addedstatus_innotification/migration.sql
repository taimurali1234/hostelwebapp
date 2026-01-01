-- CreateEnum
CREATE TYPE "reviewStatus" AS ENUM ('APPROVED', 'PENDING');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "status" "reviewStatus" NOT NULL DEFAULT 'APPROVED';

/*
  Warnings:

  - The values [SHARED] on the enum `RoomType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isAvailable` on the `Room` table. All the data in the column will be lost.
  - Added the required column `floor` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'RESERVED');

-- CreateEnum
CREATE TYPE "AvailableSeats" AS ENUM ('ALL', 'ONE_SEAT', 'TWO_SEATS', 'THREE_SEATS', 'FOUR_SEATS');

-- AlterEnum
BEGIN;
CREATE TYPE "RoomType_new" AS ENUM ('SINGLE', 'DOUBLE_SHARING', 'TRIPLE_SHARING', 'QUAD_SHARING', 'QUINT_SHARING', 'VIP_SUIT');
ALTER TABLE "Room" ALTER COLUMN "type" TYPE "RoomType_new" USING ("type"::text::"RoomType_new");
ALTER TYPE "RoomType" RENAME TO "RoomType_old";
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
DROP TYPE "public"."RoomType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "isAvailable",
ADD COLUMN     "availableSeats" "AvailableSeats" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "floor" TEXT NOT NULL,
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE';

/*
  Warnings:

  - The values [RESERVED] on the enum `RoomStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `price` on the `Room` table. All the data in the column will be lost.
  - The `availableSeats` column on the `Room` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `baseAmount` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seatsSelected` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('SHORT_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEBSITE', 'ADMIN', 'MOBILE');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
BEGIN;
CREATE TYPE "RoomStatus_new" AS ENUM ('AVAILABLE', 'BOOKED');
ALTER TABLE "public"."Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE "RoomStatus_new" USING ("status"::text::"RoomStatus_new");
ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";
DROP TYPE "public"."RoomStatus_old";
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "baseAmount" INTEGER NOT NULL,
ADD COLUMN     "bookingType" "BookingType" NOT NULL DEFAULT 'SHORT_TERM',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "discount" INTEGER,
ADD COLUMN     "seatsSelected" INTEGER NOT NULL,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE',
ADD COLUMN     "taxAmount" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "price",
ADD COLUMN     "bookedSeats" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "availableSeats",
ADD COLUMN     "availableSeats" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "AvailableSeats";

-- CreateTable
CREATE TABLE "SeatPricing" (
    "id" TEXT NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeatPricing_roomType_key" ON "SeatPricing"("roomType");

/*
  Warnings:

  - You are about to drop the column `bookingId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bookingOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookingOrderId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- DropIndex
DROP INDEX "Payment_bookingId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "bookingId",
ADD COLUMN     "bookingOrderId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingOrderId_key" ON "Payment"("bookingOrderId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `bookingOrderId` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingOrderId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BookingOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingOrder_orderNumber_key" ON "BookingOrder"("orderNumber");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOrder" ADD CONSTRAINT "BookingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "stayType" "BookingType" NOT NULL DEFAULT 'LONG_TERM';

-- AlterTable
ALTER TABLE "SeatPricing" ADD COLUMN     "stayType" "BookingType" NOT NULL DEFAULT 'LONG_TERM';

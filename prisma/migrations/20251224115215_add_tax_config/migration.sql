-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 16,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfig_pkey" PRIMARY KEY ("id")
);

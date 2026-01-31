/*
  Warnings:

  - The values [CRITICAL] on the enum `NotificationSeverity` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationSeverity_new" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS');
ALTER TABLE "public"."Notification" ALTER COLUMN "severity" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "severity" TYPE "NotificationSeverity_new" USING ("severity"::text::"NotificationSeverity_new");
ALTER TYPE "NotificationSeverity" RENAME TO "NotificationSeverity_old";
ALTER TYPE "NotificationSeverity_new" RENAME TO "NotificationSeverity";
DROP TYPE "public"."NotificationSeverity_old";
ALTER TABLE "Notification" ALTER COLUMN "severity" SET DEFAULT 'INFO';
COMMIT;

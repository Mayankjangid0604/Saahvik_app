-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "data_wiped_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY['property:manage', 'residents:manage', 'payments:record', 'reports:view', 'reports:export', 'notifications:send']::TEXT[];

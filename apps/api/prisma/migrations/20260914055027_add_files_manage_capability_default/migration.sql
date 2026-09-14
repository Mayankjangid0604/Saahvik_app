-- AlterTable
ALTER TABLE "user" ALTER COLUMN "permissions" SET DEFAULT ARRAY['property:manage', 'residents:manage', 'payments:record', 'reports:view', 'reports:export', 'notifications:send', 'files:manage']::TEXT[];

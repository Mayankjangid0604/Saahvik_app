-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('basic', 'beginner');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('vacant', 'occupied', 'maintenance');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('active', 'vacated', 'transferred');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'upi', 'bank_transfer', 'razorpay');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'whatsapp', 'push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed', 'pending_provider_config');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'basic',
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "razorpay_subscription_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otp" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wing" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "wing_id" UUID,
    "room_number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "bed_label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'vacant',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bed_id" UUID,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "photo_key" TEXT,
    "id_document_key" TEXT,
    "status" "ResidentStatus" NOT NULL DEFAULT 'active',
    "admission_date" DATE NOT NULL,
    "vacate_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_link" (
    "id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "relationship" TEXT NOT NULL,

    CONSTRAINT "guardian_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structure" (
    "id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "monthly_rent_paisa" BIGINT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "amount_paisa" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_on" DATE NOT NULL,
    "receipt_pdf_key" TEXT,
    "razorpay_payment_id" TEXT,
    "idempotency_key" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dues" (
    "id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "amount_due_paisa" BIGINT NOT NULL,
    "due_since" DATE NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient_phone" TEXT,
    "recipient_email" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "template_id" UUID,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "scheduled_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_template" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_organization_id_idx" ON "user"("organization_id");

-- CreateIndex
CREATE INDEX "email_otp_email_idx" ON "email_otp"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_key" ON "password_reset"("token");

-- CreateIndex
CREATE INDEX "property_organization_id_idx" ON "property"("organization_id");

-- CreateIndex
CREATE INDEX "wing_property_id_idx" ON "wing"("property_id");

-- CreateIndex
CREATE INDEX "room_property_id_idx" ON "room"("property_id");

-- CreateIndex
CREATE INDEX "room_wing_id_idx" ON "room"("wing_id");

-- CreateIndex
CREATE INDEX "bed_room_id_idx" ON "bed"("room_id");

-- CreateIndex
CREATE INDEX "resident_bed_id_idx" ON "resident"("bed_id");

-- CreateIndex
CREATE INDEX "resident_organization_id_idx" ON "resident"("organization_id");

-- CreateIndex
CREATE INDEX "guardian_organization_id_idx" ON "guardian"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_link_resident_id_guardian_id_key" ON "guardian_link"("resident_id", "guardian_id");

-- CreateIndex
CREATE INDEX "fee_structure_resident_id_idx" ON "fee_structure"("resident_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotency_key_key" ON "payment"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_resident_id_idx" ON "payment"("resident_id");

-- CreateIndex
CREATE INDEX "payment_paid_on_idx" ON "payment"("paid_on");

-- CreateIndex
CREATE INDEX "dues_resident_id_idx" ON "dues"("resident_id");

-- CreateIndex
CREATE INDEX "dues_due_since_idx" ON "dues"("due_since");

-- CreateIndex
CREATE INDEX "notification_organization_id_idx" ON "notification"("organization_id");

-- CreateIndex
CREATE INDEX "notification_template_organization_id_idx" ON "notification_template"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_idx" ON "audit_log"("entity_type");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_key_key" ON "idempotency_record"("key");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wing" ADD CONSTRAINT "wing_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_wing_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident" ADD CONSTRAINT "resident_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident" ADD CONSTRAINT "resident_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure" ADD CONSTRAINT "fee_structure_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues" ADD CONSTRAINT "dues_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

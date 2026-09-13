import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptService } from './receipt.service';
import { FileService } from '../file/file.service';
import { ErrorCodes } from '../common/error-codes';
import { parsePagination, PaginationQuery } from '../common/pagination';
import { PaymentMethod } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReceiptService) private readonly receiptService: ReceiptService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(FileService) private readonly fileService: FileService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async findResident(orgId: string, residentId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, organizationId: orgId },
    });
    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }
    return resident;
  }

  private async auditLog(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action,
        entityType,
        entityId,
        metadata: (metadata ?? undefined) as any,
      },
    });
  }

  // ─── Fee Structure ────────────────────────────────────────────────────

  async setFeeStructure(
    orgId: string,
    residentId: string,
    userId: string,
    monthlyRentPaisa: bigint,
    effectiveFrom: string,
  ) {
    await this.findResident(orgId, residentId);

    if (monthlyRentPaisa <= 0n) {
      throw new BadRequestException('monthlyRentPaisa must be a positive value');
    }

    const feeStructure = await this.prisma.feeStructure.create({
      data: {
        residentId,
        monthlyRentPaisa,
        effectiveFrom: new Date(effectiveFrom),
      },
    });

    await this.auditLog(orgId, userId, 'SET_FEE_STRUCTURE', 'FeeStructure', feeStructure.id, {
      residentId,
      monthlyRentPaisa: monthlyRentPaisa.toString(),
      effectiveFrom,
    });

    return this.serializeBigIntFields(feeStructure);
  }

  async getFeeStructure(orgId: string, residentId: string) {
    await this.findResident(orgId, residentId);

    const feeStructure = await this.prisma.feeStructure.findFirst({
      where: { residentId },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!feeStructure) {
      throw new NotFoundException('No fee structure found for this resident');
    }

    return this.serializeBigIntFields(feeStructure);
  }

  // ─── Payments ─────────────────────────────────────────────────────────

  async recordPayment(
    orgId: string,
    residentId: string,
    userId: string,
    data: {
      amountPaisa: bigint;
      method: PaymentMethod;
      paidOn: string;
      idempotencyKey: string;
      razorpayPaymentId?: string;
      notes?: string;
    },
  ) {
    await this.findResident(orgId, residentId);

    if (data.amountPaisa <= 0n) {
      throw new BadRequestException('amountPaisa must be a positive value');
    }

    // Idempotency check
    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: { key: data.idempotencyKey },
    });

    if (existingRecord) {
      return existingRecord.response;
    }

    // Create payment and settle dues in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          residentId,
          amountPaisa: data.amountPaisa,
          method: data.method,
          paidOn: new Date(data.paidOn),
          idempotencyKey: data.idempotencyKey,
          razorpayPaymentId: data.razorpayPaymentId ?? null,
          notes: data.notes ?? null,
        },
      });

      // Settle outstanding dues with this payment (oldest first)
      let remaining = data.amountPaisa;
      const unsettledDues = await tx.dues.findMany({
        where: { residentId, settled: false },
        orderBy: { dueSince: 'asc' },
      });

      for (const due of unsettledDues) {
        if (remaining <= 0n) break;
        if (remaining >= due.amountDuePaisa) {
          remaining -= due.amountDuePaisa;
          await tx.dues.update({
            where: { id: due.id },
            data: { settled: true, settledAt: new Date(), amountDuePaisa: 0n },
          });
        } else {
          await tx.dues.update({
            where: { id: due.id },
            data: { amountDuePaisa: due.amountDuePaisa - remaining },
          });
          remaining = 0n;
        }
      }

      const resident = await tx.resident.findUniqueOrThrow({
        where: { id: residentId },
      });
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: orgId },
      });

      return { payment, resident, org };
    });

    // Generate and persist the receipt PDF outside the DB transaction (it's
    // an external storage write, not something the transaction should hold
    // a connection open for). The key is prefixed with orgId so the file
    // ownership checks in FileService/FileController apply to it like any
    // other stored file.
    const { payment, resident, org } = result;
    const pdfBuffer = await this.receiptService.generateReceipt(
      {
        id: payment.id,
        amountPaisa: payment.amountPaisa,
        method: payment.method,
        paidOn: payment.paidOn,
        createdAt: payment.createdAt,
      },
      { fullName: resident.fullName, phone: resident.phone, email: resident.email },
      { name: org.name },
    );

    const receiptPdfKey = `${orgId}/receipts/${payment.id}.pdf`;
    await this.fileService.uploadBuffer(receiptPdfKey, pdfBuffer, 'application/pdf');
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { receiptPdfKey },
    });

    const serialized = this.serializeBigIntFields({ ...payment, receiptPdfKey });

    // Store idempotency record
    await this.prisma.idempotencyRecord.create({
      data: {
        key: data.idempotencyKey,
        response: serialized as object,
      },
    });

    await this.auditLog(orgId, userId, 'RECORD_PAYMENT', 'Payment', payment.id, {
      residentId,
      amountPaisa: data.amountPaisa.toString(),
      method: data.method,
      idempotencyKey: data.idempotencyKey,
    });

    return serialized;
  }

  async getPayments(
    orgId: string,
    residentId: string,
    query: PaginationQuery,
  ) {
    await this.findResident(orgId, residentId);

    const { page, pageSize, skip, take } = parsePagination(query);

    const where = { residentId };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { paidOn: query.sortDir || 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: items.map((p) => this.serializeBigIntFields(p)),
      total,
      page,
      pageSize,
    };
  }

  async getPaymentReceipt(orgId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { resident: { select: { organizationId: true } } },
    });

    if (!payment || payment.resident.organizationId !== orgId) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (!payment.receiptPdfKey) {
      throw new NotFoundException('Receipt not available for this payment');
    }

    return { receiptPdfKey: payment.receiptPdfKey };
  }

  // ─── Dues ─────────────────────────────────────────────────────────────

  async getDues(
    orgId: string,
    query: { page?: number; pageSize?: number; settled?: boolean },
  ) {
    const { page, pageSize, skip, take } = parsePagination(query);

    const where: Record<string, unknown> = {
      resident: { organizationId: orgId },
    };
    if (query.settled !== undefined) {
      where.settled = query.settled;
    }

    const [items, total] = await Promise.all([
      this.prisma.dues.findMany({
        where,
        include: {
          resident: {
            select: { id: true, fullName: true, phone: true },
          },
        },
        orderBy: { dueSince: 'desc' },
        skip,
        take,
      }),
      this.prisma.dues.count({ where }),
    ]);

    return {
      items: items.map((d) => this.serializeBigIntFields(d)),
      total,
      page,
      pageSize,
    };
  }

  async getResidentDues(orgId: string, residentId: string) {
    await this.findResident(orgId, residentId);

    const dues = await this.prisma.dues.findMany({
      where: { residentId },
      orderBy: { dueSince: 'desc' },
    });

    return dues.map((d) => this.serializeBigIntFields(d));
  }

  async calculateDues(orgId: string) {
    const activeResidents = await this.prisma.resident.findMany({
      where: { organizationId: orgId, status: 'active' },
      include: {
        feeStructures: { orderBy: { effectiveFrom: 'desc' } },
        payments: true,
        dues: true,
      },
    });

    const now = new Date();
    let updated = 0;

    for (const resident of activeResidents) {
      if (resident.feeStructures.length === 0) continue;

      // Calculate total rent owed from admission to now using fee structure history
      let totalRentOwed = 0n;
      const admissionDate = new Date(resident.admissionDate);

      // Sort fee structures by effectiveFrom ascending for chronological processing
      const feeStructures = [...resident.feeStructures].sort(
        (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
      );

      for (let i = 0; i < feeStructures.length; i++) {
        const fs = feeStructures[i];
        const periodStart = fs.effectiveFrom < admissionDate ? admissionDate : fs.effectiveFrom;
        const periodEnd = i + 1 < feeStructures.length
          ? feeStructures[i + 1].effectiveFrom
          : now;

        if (periodStart >= periodEnd) continue;

        const months = this.monthsBetween(periodStart, periodEnd);
        totalRentOwed += fs.monthlyRentPaisa * BigInt(months);
      }

      // Calculate total paid
      const totalPaid = resident.payments.reduce(
        (sum, p) => sum + p.amountPaisa,
        0n,
      );

      const netDue = totalRentOwed - totalPaid;

      if (netDue > 0n) {
        // Find existing unsettled dues record or create one
        const existingDue = await this.prisma.dues.findFirst({
          where: { residentId: resident.id, settled: false },
        });

        if (existingDue) {
          await this.prisma.dues.update({
            where: { id: existingDue.id },
            data: { amountDuePaisa: netDue },
          });
        } else {
          await this.prisma.dues.create({
            data: {
              residentId: resident.id,
              amountDuePaisa: netDue,
              dueSince: admissionDate,
            },
          });
        }
        updated++;
      } else {
        // Mark all unsettled dues as settled
        await this.prisma.dues.updateMany({
          where: { residentId: resident.id, settled: false },
          data: { settled: true, settledAt: now },
        });
      }
    }

    return { residentsProcessed: activeResidents.length, duesUpdated: updated };
  }

  // ─── Razorpay ─────────────────────────────────────────────────────────

  async createRazorpayOrder(
    orgId: string,
    residentId: string,
    amountPaisa: bigint,
  ) {
    await this.findResident(orgId, residentId);

    // Verify org is on beginner plan
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    if (org.subscriptionPlan !== 'beginner') {
      throw new ForbiddenException(
        'Online payments require the Beginner subscription plan',
      );
    }

    if (amountPaisa <= 0n) {
      throw new BadRequestException('amountPaisa must be a positive value');
    }

    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new BadRequestException(
        'Razorpay is not configured for this deployment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)',
      );
    }

    const Razorpay = await import('razorpay');
    const razorpay = new Razorpay.default({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Number(amountPaisa), // Razorpay accepts amount in paisa as Number
      currency: 'INR',
      receipt: `${orgId}_${residentId}_${Date.now()}`,
      notes: {
        orgId,
        residentId,
      },
    });

    return {
      orderId: order.id,
      amount: amountPaisa.toString(),
      currency: 'INR',
      keyId: this.configService.get<string>('RAZORPAY_KEY_ID'),
    };
  }

  async handleRazorpayWebhook(body: Record<string, unknown>, signature: string) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    // Verify HMAC SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event as string | undefined;
    const payload = body.payload as Record<string, unknown> | undefined;

    if (!event || !payload) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const paymentEntity = (
      payload.payment as Record<string, unknown> | undefined
    )?.entity as Record<string, unknown> | undefined;

    if (!paymentEntity) {
      return { status: 'ignored', reason: 'no payment entity' };
    }

    const razorpayPaymentId = paymentEntity.id as string;
    const orderId = paymentEntity.order_id as string;
    const notes = paymentEntity.notes as Record<string, string> | undefined;
    const amountPaisa = BigInt(paymentEntity.amount as number);
    const orgId = notes?.orgId;
    const residentId = notes?.residentId;

    if (!orgId || !residentId) {
      return { status: 'ignored', reason: 'missing org/resident in notes' };
    }

    if (event === 'payment.captured') {
      // Record the payment
      const idempotencyKey = `razorpay_${razorpayPaymentId}`;

      // Check if already processed
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing) {
        return { status: 'already_processed' };
      }

      await this.recordPayment(orgId, residentId, orgId, {
        amountPaisa,
        method: PaymentMethod.razorpay,
        paidOn: new Date().toISOString(),
        idempotencyKey,
        razorpayPaymentId,
        notes: `Razorpay order: ${orderId}`,
      });

      return { status: 'payment_recorded', razorpayPaymentId };
    }

    if (event === 'payment.failed') {
      this.logger.warn(
        `Razorpay payment failed: ${razorpayPaymentId} for resident ${residentId}`,
      );
      return { status: 'payment_failed', razorpayPaymentId };
    }

    return { status: 'ignored', event };
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  /**
   * Count whole months between two dates.
   */
  private monthsBetween(from: Date, to: Date): number {
    const yearDiff = to.getFullYear() - from.getFullYear();
    const monthDiff = to.getMonth() - from.getMonth();
    const total = yearDiff * 12 + monthDiff;
    // If the day in 'to' is before the day in 'from', subtract one month
    if (to.getDate() < from.getDate()) {
      return Math.max(0, total - 1);
    }
    return Math.max(0, total);
  }

  /**
   * Serialize BigInt fields to strings for JSON responses.
   * Prisma returns BigInt fields which cannot be serialized to JSON directly.
   */
  private serializeBigIntFields<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'bigint') {
        result[key] = value.toString();
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = this.serializeBigIntFields(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

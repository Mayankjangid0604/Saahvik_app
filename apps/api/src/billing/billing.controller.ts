import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import {
  CurrentUser,
  RequestUser,
  Roles,
  RolesGuard,
  RequireCapability,
  CapabilityGuard,
} from '../common/decorators';
import { wrapSuccess } from '../common/response';
import {
  SetFeeStructureDto,
  RecordPaymentDto,
  PaymentQueryDto,
  DuesQueryDto,
  CreateRazorpayOrderDto,
} from './dto';

@Controller()
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
  ) {}

  // ─── Fee Structure ────────────────────────────────────────────────────

  @Post('residents/:id/fee-structure')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequireCapability('billing:manage_fee_structure')
  async setFeeStructure(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
    @Body() dto: SetFeeStructureDto,
  ) {
    const result = await this.billingService.setFeeStructure(
      user.organizationId,
      residentId,
      user.id,
      dto.monthlyRentPaisa,
      dto.effectiveFrom,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('residents/:id/fee-structure')
  @UseGuards(JwtAuthGuard)
  async getFeeStructure(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
  ) {
    const result = await this.billingService.getFeeStructure(
      user.organizationId,
      residentId,
    );
    return wrapSuccess(result, 'v1');
  }

  // ─── Payments ─────────────────────────────────────────────────────────

  @Post('residents/:id/payments')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequireCapability('payments:record')
  async recordPayment(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
    @Body() dto: RecordPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.billingService.recordPayment(
      user.organizationId,
      residentId,
      user.id,
      {
        amountPaisa: dto.amountPaisa,
        method: dto.method,
        paidOn: dto.paidOn,
        idempotencyKey,
        razorpayPaymentId: dto.razorpayPaymentId,
        notes: dto.notes,
      },
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('residents/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.staff)
  async getPayments(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
    @Query() query: PaymentQueryDto,
  ) {
    const result = await this.billingService.getPayments(
      user.organizationId,
      residentId,
      query,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('residents/:id/payments/:paymentId/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.staff)
  async getPaymentReceipt(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) _residentId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const result = await this.billingService.getPaymentReceipt(
      user.organizationId,
      paymentId,
    );
    return wrapSuccess(result, 'v1');
  }

  // ─── Dues ─────────────────────────────────────────────────────────────

  @Get('dues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.staff)
  async getDues(
    @CurrentUser() user: RequestUser,
    @Query() query: DuesQueryDto,
  ) {
    const result = await this.billingService.getDues(
      user.organizationId,
      query,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('residents/:id/dues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.staff)
  async getResidentDues(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
  ) {
    const result = await this.billingService.getResidentDues(
      user.organizationId,
      residentId,
    );
    return wrapSuccess(result, 'v1');
  }

  // ─── Razorpay ─────────────────────────────────────────────────────────

  @Post('residents/:id/payments/razorpay-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.staff)
  async createRazorpayOrder(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) residentId: string,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    const result = await this.billingService.createRazorpayOrder(
      user.organizationId,
      residentId,
      dto.amountPaisa,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post('billing/razorpay/webhook')
  async handleRazorpayWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const result = await this.billingService.handleRazorpayWebhook(body, signature);
    return wrapSuccess(result, 'v1');
  }
}

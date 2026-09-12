import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ReceiptService } from './receipt.service';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [BillingService, ReceiptService],
  exports: [BillingService],
})
export class BillingModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ReceiptService } from './receipt.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [ConfigModule, FileModule],
  controllers: [BillingController],
  providers: [BillingService, ReceiptService],
  exports: [BillingService],
})
export class BillingModule {}

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') return BigInt(value);
    if (typeof value === 'number') return BigInt(value);
    return value;
  })
  amountPaisa: bigint;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsDateString()
  @IsNotEmpty()
  paidOn: string;

  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

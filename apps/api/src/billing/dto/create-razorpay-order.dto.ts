import { IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRazorpayOrderDto {
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') return BigInt(value);
    if (typeof value === 'number') return BigInt(value);
    return value;
  })
  amountPaisa: bigint;
}

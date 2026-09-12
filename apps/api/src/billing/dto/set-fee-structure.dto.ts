import { IsDateString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetFeeStructureDto {
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') return BigInt(value);
    if (typeof value === 'number') return BigInt(value);
    return value;
  })
  monthlyRentPaisa: bigint;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;
}

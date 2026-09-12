import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BedInput {
  @IsString()
  @IsNotEmpty()
  bedLabel: string;
}

export class CreateBedsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BedInput)
  beds: BedInput[];
}

import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RoomInput {
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @IsInt()
  floor: number;

  @IsOptional()
  @IsUUID()
  wingId?: string;
}

export class CreateRoomsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RoomInput)
  rooms: RoomInput[];
}

import { IsUUID } from 'class-validator';

export class TransferResidentDto {
  @IsUUID()
  newBedId: string;
}

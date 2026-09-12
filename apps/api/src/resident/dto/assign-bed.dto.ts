import { IsUUID } from 'class-validator';

export class AssignBedDto {
  @IsUUID()
  bedId: string;
}

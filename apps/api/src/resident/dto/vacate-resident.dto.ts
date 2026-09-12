import { IsDateString } from 'class-validator';

export class VacateResidentDto {
  @IsDateString()
  vacateDate: string;
}

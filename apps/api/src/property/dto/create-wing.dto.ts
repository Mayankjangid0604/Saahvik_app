import { IsNotEmpty, IsString } from 'class-validator';

export class CreateWingDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

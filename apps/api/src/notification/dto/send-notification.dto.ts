import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class SendNotificationDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}

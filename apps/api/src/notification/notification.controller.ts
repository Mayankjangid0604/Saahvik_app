import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import {
  SendNotificationDto,
  BroadcastNotificationDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  ScheduleNotificationDto,
} from './dto';

interface AuthUser {
  userId: string;
  orgId: string;
  role: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  @Post('send')
  async send(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendNotificationDto,
  ) {
    const result = await this.notificationService.sendNotification(
      user.orgId,
      dto.channel,
      dto.to,
      dto.subject,
      dto.body,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post('broadcast')
  async broadcast(
    @CurrentUser() user: AuthUser,
    @Body() dto: BroadcastNotificationDto,
  ) {
    const result = await this.notificationService.broadcastNotification(
      user.orgId,
      dto.channel,
      dto.subject,
      dto.body,
      dto.recipients,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('templates')
  async getTemplates(@CurrentUser() user: AuthUser) {
    const templates = await this.notificationService.getTemplates(user.orgId);
    return wrapSuccess(templates, 'v1');
  }

  @Post('templates')
  async createTemplate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTemplateDto,
  ) {
    const template = await this.notificationService.createTemplate(
      user.orgId,
      dto,
    );
    return wrapSuccess(template, 'v1');
  }

  @Patch('templates/:id')
  async updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const template = await this.notificationService.updateTemplate(
      user.orgId,
      id,
      dto,
    );
    return wrapSuccess(template, 'v1');
  }

  @Post('schedule')
  async schedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: ScheduleNotificationDto,
  ) {
    const notification = await this.notificationService.scheduleNotification(
      user.orgId,
      dto,
    );
    return wrapSuccess(notification, 'v1');
  }
}

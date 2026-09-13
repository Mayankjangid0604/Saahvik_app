import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser, RequireCapability, CapabilityGuard } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import {
  SendNotificationDto,
  BroadcastNotificationDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  ScheduleNotificationDto,
} from './dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.notificationService.getNotifications(user.organizationId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return wrapSuccess(result, 'v1');
  }

  @Post('send')
  @UseGuards(CapabilityGuard)
  @RequireCapability('notifications:send')
  async send(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendNotificationDto,
  ) {
    const result = await this.notificationService.sendNotification(
      user.organizationId,
      dto.channel,
      dto.to,
      dto.subject,
      dto.body,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post('broadcast')
  @UseGuards(CapabilityGuard)
  @RequireCapability('notifications:send')
  async broadcast(
    @CurrentUser() user: RequestUser,
    @Body() dto: BroadcastNotificationDto,
  ) {
    const result = await this.notificationService.broadcastNotification(
      user.organizationId,
      dto.channel,
      dto.subject,
      dto.body,
      dto.recipients,
    );
    return wrapSuccess(result, 'v1');
  }

  @Get('templates')
  async getTemplates(@CurrentUser() user: RequestUser) {
    const templates = await this.notificationService.getTemplates(user.organizationId);
    return wrapSuccess(templates, 'v1');
  }

  @Post('templates')
  @UseGuards(CapabilityGuard)
  @RequireCapability('notifications:manage_templates')
  async createTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTemplateDto,
  ) {
    const template = await this.notificationService.createTemplate(
      user.organizationId,
      dto,
    );
    return wrapSuccess(template, 'v1');
  }

  @Patch('templates/:id')
  @UseGuards(CapabilityGuard)
  @RequireCapability('notifications:manage_templates')
  async updateTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const template = await this.notificationService.updateTemplate(
      user.organizationId,
      id,
      dto,
    );
    return wrapSuccess(template, 'v1');
  }

  @Post('schedule')
  async schedule(
    @CurrentUser() user: RequestUser,
    @Body() dto: ScheduleNotificationDto,
  ) {
    const notification = await this.notificationService.scheduleNotification(
      user.organizationId,
      dto,
    );
    return wrapSuccess(notification, 'v1');
  }
}

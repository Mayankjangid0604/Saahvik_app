import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser, RequireCapability, CapabilityGuard } from '../common/decorators';
import { wrapSuccess } from '../common/response';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, CapabilityGuard)
export class AuditController {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireCapability('audit:view')
  async getAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.auditService.getAuditLogs(user.organizationId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      entityType,
      userId,
      startDate,
      endDate,
    });
    return wrapSuccess(data, 'v1');
  }
}

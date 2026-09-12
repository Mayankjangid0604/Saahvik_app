import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';

interface AuthUser {
  userId: string;
  orgId: string;
  role: string;
}

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  @Get()
  async getAuditLogs(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Owner-only access
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can view audit logs');
    }

    const data = await this.auditService.getAuditLogs(user.orgId, {
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

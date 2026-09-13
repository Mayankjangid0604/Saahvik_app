import {
  Controller,
  Get,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  async getDashboard(@CurrentUser() user: RequestUser) {
    const data = await this.dashboardService.getDashboardSummary(user.organizationId);
    return wrapSuccess(data, 'v1');
  }
}

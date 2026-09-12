import {
  Controller,
  Get,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';

interface AuthUser {
  userId: string;
  orgId: string;
  role: string;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  async getDashboard(@CurrentUser() user: AuthUser) {
    const data = await this.dashboardService.getDashboardSummary(user.orgId);
    return wrapSuccess(data, 'v1');
  }
}

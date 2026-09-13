import { Controller, Get, UseGuards, Inject, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser, RequestUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() user: RequestUser) {
    const profile = await this.authService.validateUserById(user.id);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    const { id, name, email, role, permissions } = profile;
    return wrapSuccess({ id, name, email, role, permissions }, 'v1');
  }
}

import { Controller, Post, Body, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SignupDto,
  LoginDto,
  VerifyEmailOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { wrapSuccess } from '../common/response';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    const result = await this.authService.signup(
      dto.email,
      dto.password,
      dto.name,
      dto.orgName,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return wrapSuccess(result, 'v1');
  }

  @Post('verify-email-otp')
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    const result = await this.authService.verifyEmailOtp(dto.email, dto.otp);
    return wrapSuccess(result, 'v1');
  }

  @Post('resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    const result = await this.authService.resendOtp(dto.email);
    return wrapSuccess(result, 'v1');
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);
    return wrapSuccess(result, 'v1');
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
    );
    return wrapSuccess(result, 'v1');
  }

  @Post('staff-login')
  async staffLogin(@Body() dto: LoginDto) {
    const result = await this.authService.staffLogin(dto.email, dto.password);
    return wrapSuccess(result, 'v1');
  }
}

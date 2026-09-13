import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { ErrorCodes } from '../common/error-codes';

const BCRYPT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {}

  async signup(
    email: string,
    password: string,
    name: string,
    orgName: string,
  ): Promise<{ userId: string; organizationId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(ErrorCodes.EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName },
      });

      const property = await tx.property.create({
        data: {
          organizationId: organization.id,
          name: `${orgName} - Main`,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          name,
          role: 'owner',
        },
      });

      return { userId: user.id, organizationId: organization.id, propertyId: property.id };
    });

    const otp = this.generateOtp();
    await this.prisma.emailOtp.create({
      data: {
        email,
        otp,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    await this.emailService.sendOtpEmail(email, otp).catch((err) => {
      this.logger.error(`Failed to send OTP email during signup: ${err}`);
    });

    return {
      userId: result.userId,
      organizationId: result.organizationId,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please verify your email first.');
    }

    const payload = {
      sub: user.id,
      orgId: user.organizationId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  async verifyEmailOtp(
    email: string,
    otp: string,
  ): Promise<{ verified: boolean }> {
    const otpRecord = await this.prisma.emailOtp.findFirst({
      where: {
        email,
        otp,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      const expiredOtp = await this.prisma.emailOtp.findFirst({
        where: { email, otp, verified: false },
        orderBy: { createdAt: 'desc' },
      });

      if (expiredOtp) {
        throw new BadRequestException(ErrorCodes.OTP_EXPIRED);
      }
      throw new BadRequestException(ErrorCodes.INVALID_OTP);
    }

    await this.prisma.$transaction([
      this.prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      }),
      this.prisma.user.updateMany({
        where: { email },
        data: { emailVerified: true },
      }),
    ]);

    return { verified: true };
  }

  async resendOtp(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException(ErrorCodes.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified.');
    }

    const windowStart = new Date(
      Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    );
    const recentOtpCount = await this.prisma.emailOtp.count({
      where: {
        email,
        createdAt: { gte: windowStart },
      },
    });

    if (recentOtpCount >= OTP_RATE_LIMIT_MAX) {
      throw new BadRequestException(ErrorCodes.RATE_LIMITED);
    }

    const otp = this.generateOtp();
    await this.prisma.emailOtp.create({
      data: {
        email,
        otp,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    await this.emailService.sendOtpEmail(email, otp);

    return { sent: true };
  }

  async forgotPassword(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return { sent: true };
    }

    // Invalidate any existing unused reset tokens for this user
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(
          Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    await this.emailService.sendPasswordResetEmail(email, token).catch((err) => {
      this.logger.error(`Failed to send password reset email: ${err}`);
    });

    return { sent: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ reset: boolean }> {
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException(ErrorCodes.INVALID_RESET_TOKEN);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
    ]);

    return { reset: true };
  }

  async staffLogin(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    if (user.role !== 'staff') {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please verify your email first.');
    }

    const payload = {
      sub: user.id,
      orgId: user.organizationId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  async validateUserById(userId: string): Promise<{
    id: string;
    organizationId: string;
    role: string;
    email: string;
    name: string;
    permissions: string[];
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        email: true,
        name: true,
        permissions: true,
      },
    });
    return user;
  }

  private generateOtp(): string {
    const num = Math.floor(100000 + Math.random() * 900000);
    return num.toString();
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  emailOtp: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  organization: { create: jest.fn() },
  property: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

const mockEmailService = {
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signup', () => {
    it('should create user and organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          organization: { create: jest.fn().mockResolvedValue({ id: 'org-1' }) },
          property: { create: jest.fn().mockResolvedValue({ id: 'prop-1' }) },
          user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        };
        return fn(tx);
      });
      mockPrisma.emailOtp.create.mockResolvedValue({});

      const result = await service.signup('test@example.com', 'Pass123!', 'Test', 'TestOrg');

      expect(result).toEqual({
        userId: 'user-1',
        organizationId: 'org-1',
      });
      expect(mockPrisma.emailOtp.create).toHaveBeenCalled();
      expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('should throw ConflictException if email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.signup('test@example.com', 'Pass123!', 'Test', 'TestOrg'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return JWT on valid credentials', async () => {
      const hash = await bcrypt.hash('Pass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hash,
        emailVerified: true,
        organizationId: 'org-1',
        role: 'owner',
      });

      const result = await service.login('test@example.com', 'Pass123!');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        orgId: 'org-1',
        role: 'owner',
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('Pass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: hash,
        emailVerified: true,
      });

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for unverified email', async () => {
      const hash = await bcrypt.hash('Pass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: hash,
        emailVerified: false,
      });

      await expect(service.login('test@example.com', 'Pass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('no@example.com', 'Pass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmailOtp', () => {
    it('should verify valid OTP', async () => {
      mockPrisma.emailOtp.findFirst.mockResolvedValue({
        id: 'otp-1',
        email: 'test@example.com',
        otp: '123456',
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.verifyEmailOtp('test@example.com', '123456');
      expect(result).toEqual({ verified: true });
    });

    it('should throw for expired OTP', async () => {
      mockPrisma.emailOtp.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'otp-1' });

      await expect(
        service.verifyEmailOtp('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('should return success even for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('no@example.com');
      expect(result).toEqual({ sent: true });
    });

    it('should create reset token for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.passwordReset.updateMany.mockResolvedValue({});
      mockPrisma.passwordReset.create.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');
      expect(result).toEqual({ sent: true });
      expect(mockPrisma.passwordReset.create).toHaveBeenCalled();
    });
  });

  describe('staffLogin', () => {
    it('should reject non-staff users', async () => {
      const hash = await bcrypt.hash('Pass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: hash,
        emailVerified: true,
        role: 'owner',
      });

      await expect(service.staffLogin('test@example.com', 'Pass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

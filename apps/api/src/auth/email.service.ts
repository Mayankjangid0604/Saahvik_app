import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      'Saahvik <noreply@saahvik.com>';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY not configured. Emails will be logged but not sent.',
      );
    }
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const subject = 'Your Saahvik verification code';
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #333;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #888; font-size: 12px;">If you did not request this code, please ignore this email.</p>
      </div>
    `;

    await this.send(email, subject, html);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3001';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset your Saahvik password';
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #333; color: #fff; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    await this.send(email, subject, html);
  }

  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.log(
        `[EMAIL NOT SENT - NO API KEY] To: ${to} | Subject: ${subject}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      throw error;
    }
  }
}

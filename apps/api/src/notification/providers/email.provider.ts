import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

@Injectable()
export class EmailProvider implements NotificationProvider {
  private readonly logger = new Logger(EmailProvider.name);
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

  isConfigured(): boolean {
    return this.resend !== null;
  }

  async send(to: string, payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.resend) {
      this.logger.log(
        `[EMAIL NOT SENT - NO API KEY] To: ${to} | Subject: ${payload.subject}`,
      );
      return {
        success: false,
        status: 'pending_provider_config',
        errorMessage: 'RESEND_API_KEY not configured',
      };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: payload.subject || '(No subject)',
        html: payload.body,
      });

      this.logger.log(`Email sent to ${to}: ${payload.subject}`);
      return {
        success: true,
        messageId: result.data?.id,
        status: 'sent',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}: ${message}`);
      return {
        success: false,
        status: 'failed',
        errorMessage: message,
      };
    }
  }
}

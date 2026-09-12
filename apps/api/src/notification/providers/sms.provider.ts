import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

@Injectable()
export class SmsProvider implements NotificationProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private readonly authKey: string | undefined;
  private readonly senderId: string;
  private readonly route: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    this.senderId = this.configService.get<string>('MSG91_SENDER_ID') || 'SAAHVK';
    this.route = this.configService.get<string>('MSG91_ROUTE') || '4';

    if (!this.authKey) {
      this.logger.warn(
        'MSG91_AUTH_KEY not configured. SMS notifications will return pending_provider_config.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.authKey;
  }

  async send(to: string, payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      this.logger.log(`[SMS NOT SENT - NO AUTH KEY] To: ${to}`);
      return {
        success: false,
        status: 'pending_provider_config',
        errorMessage: 'MSG91_AUTH_KEY not configured',
      };
    }

    try {
      const url = 'https://api.msg91.com/api/v5/flow/';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey!,
        },
        body: JSON.stringify({
          sender: this.senderId,
          route: this.route,
          mobiles: to,
          message: payload.body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`MSG91 SMS failed for ${to}: ${errorText}`);
        return {
          success: false,
          status: 'failed',
          errorMessage: `MSG91 returned ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      this.logger.log(`SMS sent to ${to} via MSG91`);
      return {
        success: true,
        messageId: data.request_id || data.message,
        status: 'sent',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send SMS to ${to}: ${message}`);
      return {
        success: false,
        status: 'failed',
        errorMessage: message,
      };
    }
  }
}

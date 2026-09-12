import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

@Injectable()
export class WhatsappProvider implements NotificationProvider {
  private readonly logger = new Logger(WhatsappProvider.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('WHATSAPP_API_KEY');
    this.baseUrl =
      this.configService.get<string>('WHATSAPP_API_URL') ||
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

    if (!this.apiKey) {
      this.logger.warn(
        'WHATSAPP_API_KEY not configured. WhatsApp notifications will return pending_provider_config.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(to: string, payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      this.logger.log(`[WHATSAPP NOT SENT - NO API KEY] To: ${to}`);
      return {
        success: false,
        status: 'pending_provider_config',
        errorMessage: 'WHATSAPP_API_KEY not configured',
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.apiKey!,
        },
        body: JSON.stringify({
          integrated_number: this.configService.get<string>('WHATSAPP_SENDER_NUMBER') || '',
          content_type: 'text',
          payload: {
            to,
            type: 'text',
            messaging_product: 'whatsapp',
            text: {
              body: payload.body,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`WhatsApp send failed for ${to}: ${errorText}`);
        return {
          success: false,
          status: 'failed',
          errorMessage: `WhatsApp API returned ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      this.logger.log(`WhatsApp message sent to ${to}`);
      return {
        success: true,
        messageId: data.request_id || data.id,
        status: 'sent',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${message}`);
      return {
        success: false,
        status: 'failed',
        errorMessage: message,
      };
    }
  }
}

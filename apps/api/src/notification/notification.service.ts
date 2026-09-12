import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { NotificationProvider } from './providers/notification-provider.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly providerMap: Record<string, NotificationProvider>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailProvider) private readonly emailProvider: EmailProvider,
    @Inject(SmsProvider) private readonly smsProvider: SmsProvider,
    @Inject(WhatsappProvider) private readonly whatsappProvider: WhatsappProvider,
  ) {
    this.providerMap = {
      [NotificationChannel.email]: this.emailProvider,
      [NotificationChannel.sms]: this.smsProvider,
      [NotificationChannel.whatsapp]: this.whatsappProvider,
    };
  }

  private getProvider(channel: NotificationChannel): NotificationProvider {
    const provider = this.providerMap[channel];
    if (!provider) {
      throw new BadRequestException(
        `Unsupported notification channel: ${channel}`,
      );
    }
    return provider;
  }

  async sendNotification(
    orgId: string,
    channel: NotificationChannel,
    to: string,
    subject: string | undefined,
    body: string,
  ) {
    const provider = this.getProvider(channel);

    // Create the notification record first
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: orgId,
        channel,
        recipientEmail: channel === NotificationChannel.email ? to : null,
        recipientPhone:
          channel === NotificationChannel.sms ||
          channel === NotificationChannel.whatsapp
            ? to
            : null,
        subject: subject || null,
        body,
        status: NotificationStatus.queued,
      },
    });

    // If provider is not configured, mark accordingly
    if (!provider.isConfigured()) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.pending_provider_config,
          errorMessage: `${channel} provider is not configured`,
        },
      });
      return {
        id: notification.id,
        status: NotificationStatus.pending_provider_config,
        message: `${channel} provider is not configured. Notification has been logged.`,
      };
    }

    // Send via provider
    const result = await provider.send(to, { subject, body });

    // Update notification record with result
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: result.success
          ? NotificationStatus.sent
          : NotificationStatus.failed,
        sentAt: result.success ? new Date() : null,
        errorMessage: result.errorMessage || null,
      },
    });

    return {
      id: notification.id,
      status: result.status,
      messageId: result.messageId,
      errorMessage: result.errorMessage,
    };
  }

  async broadcastNotification(
    orgId: string,
    channel: NotificationChannel,
    subject: string | undefined,
    body: string,
    recipients: string[],
  ) {
    const results = await Promise.allSettled(
      recipients.map((to) =>
        this.sendNotification(orgId, channel, to, subject, body),
      ),
    );

    const sent: string[] = [];
    const failed: { recipient: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'sent') {
        sent.push(recipients[index]);
      } else {
        const errorMessage =
          result.status === 'rejected'
            ? String(result.reason)
            : result.value.errorMessage || result.value.status;
        failed.push({ recipient: recipients[index], error: errorMessage || 'Unknown error' });
      }
    });

    return {
      totalRecipients: recipients.length,
      sent: sent.length,
      failed: failed.length,
      details: { sent, failed },
    };
  }

  async getTemplates(orgId: string) {
    return this.prisma.notificationTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(
    orgId: string,
    data: {
      name: string;
      channel: NotificationChannel;
      subject?: string;
      body: string;
      variables?: string[];
    },
  ) {
    return this.prisma.notificationTemplate.create({
      data: {
        organizationId: orgId,
        name: data.name,
        channel: data.channel,
        subject: data.subject || null,
        body: data.body,
        variables: data.variables || [],
      },
    });
  }

  async updateTemplate(
    orgId: string,
    templateId: string,
    data: {
      name?: string;
      channel?: NotificationChannel;
      subject?: string;
      body?: string;
      variables?: string[];
    },
  ) {
    // Verify template belongs to org
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });
    if (!template) {
      throw new BadRequestException('Template not found');
    }

    return this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.variables !== undefined && { variables: data.variables }),
      },
    });
  }

  async scheduleNotification(
    orgId: string,
    data: {
      channel: NotificationChannel;
      to: string;
      subject?: string;
      body: string;
      scheduledAt: string;
    },
  ) {
    return this.prisma.notification.create({
      data: {
        organizationId: orgId,
        channel: data.channel,
        recipientEmail:
          data.channel === NotificationChannel.email ? data.to : null,
        recipientPhone:
          data.channel === NotificationChannel.sms ||
          data.channel === NotificationChannel.whatsapp
            ? data.to
            : null,
        subject: data.subject || null,
        body: data.body,
        status: NotificationStatus.queued,
        scheduledAt: new Date(data.scheduledAt),
      },
    });
  }
}

export interface NotificationPayload {
  subject?: string;
  body: string;
  templateId?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'failed' | 'pending_provider_config';
  errorMessage?: string;
}

export interface NotificationProvider {
  send(to: string, payload: NotificationPayload): Promise<NotificationResult>;
  isConfigured(): boolean;
}

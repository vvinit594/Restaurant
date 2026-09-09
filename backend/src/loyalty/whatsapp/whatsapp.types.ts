export type WhatsappSendInput = {
  to: string;
  message: string;
};

export type WhatsappSendResult = {
  ok: boolean;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  providerMessageId?: string | null;
  providerPayload?: Record<string, unknown> | null;
  failureReason?: string | null;
};

export interface WhatsappProvider {
  sendPromotionalMessage(input: WhatsappSendInput): Promise<WhatsappSendResult>;
}

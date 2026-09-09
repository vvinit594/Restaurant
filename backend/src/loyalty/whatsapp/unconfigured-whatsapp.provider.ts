import { Injectable } from '@nestjs/common';
import { WhatsappProvider, WhatsappSendInput, WhatsappSendResult } from './whatsapp.types';

@Injectable()
export class UnconfiguredWhatsappProvider implements WhatsappProvider {
  async sendPromotionalMessage(
    input: WhatsappSendInput,
  ): Promise<WhatsappSendResult> {
    return {
      ok: false,
      status: 'FAILED',
      providerMessageId: null,
      providerPayload: {
        provider: 'unconfigured',
        to: input.to,
      },
      failureReason:
        'WhatsApp provider is not configured yet. Connect an approved provider to send messages.',
    };
  }
}

import { Injectable } from '@nestjs/common';
import { UnconfiguredWhatsappProvider } from './unconfigured-whatsapp.provider';
import { WhatsappSendInput } from './whatsapp.types';

@Injectable()
export class LoyaltyWhatsappService {
  constructor(
    private readonly provider: UnconfiguredWhatsappProvider,
  ) {}

  sendPromotionalMessage(input: WhatsappSendInput) {
    return this.provider.sendPromotionalMessage(input);
  }
}

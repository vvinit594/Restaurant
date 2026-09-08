import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsGraceCron {
  private readonly logger = new Logger(PaymentsGraceCron.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleGraceExpiry() {
    try {
      const result = await this.payments.suspendExpiredGracePeriods();
      if (result.suspended > 0) {
        this.logger.warn(
          `Grace-period job suspended ${result.suspended} restaurant(s).`,
        );
      }
    } catch (err) {
      this.logger.error('Grace-period cron failed', err as Error);
    }
  }
}

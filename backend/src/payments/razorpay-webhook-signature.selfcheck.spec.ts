/**
 * Razorpay webhook HMAC self-check (fake secret only).
 * Run: npx jest src/payments/razorpay-webhook-signature.selfcheck.spec.ts
 */
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RazorpayClientService } from './razorpay-client.service';
import { extractRazorpayWebhookRawBody } from './webhook-raw-body';

const FAKE_SECRET = 'dilyum_test_webhook_secret_not_production';
const RAW_PAYLOAD = '{"id":"evt_test_1","event":"subscription.pending","payload":{}}';

function hmacHex(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function serviceWithSecret(secret: string) {
  const config = {
    get: (key: string) =>
      key === 'RAZORPAY_WEBHOOK_SECRET' ? secret : undefined,
  };
  return new RazorpayClientService(config as ConfigService);
}

describe('Razorpay webhook HMAC (fake secret)', () => {
  it('A: correct secret + exact raw payload succeeds', () => {
    const rzp = serviceWithSecret(FAKE_SECRET);
    const signature = hmacHex(RAW_PAYLOAD, FAKE_SECRET);
    expect(rzp.verifyWebhookSignature(Buffer.from(RAW_PAYLOAD), signature)).toBe(
      true,
    );
  });

  it('B: wrong secret fails', () => {
    const rzp = serviceWithSecret(FAKE_SECRET);
    const signature = hmacHex(RAW_PAYLOAD, 'some_other_fake_secret');
    expect(rzp.verifyWebhookSignature(Buffer.from(RAW_PAYLOAD), signature)).toBe(
      false,
    );
  });

  it('C: modified payload fails', () => {
    const rzp = serviceWithSecret(FAKE_SECRET);
    const signature = hmacHex(RAW_PAYLOAD, FAKE_SECRET);
    const tampered = RAW_PAYLOAD.replace('pending', 'charged');
    expect(rzp.verifyWebhookSignature(Buffer.from(tampered), signature)).toBe(
      false,
    );
  });

  it('D: missing signature fails', () => {
    const rzp = serviceWithSecret(FAKE_SECRET);
    expect(rzp.verifyWebhookSignature(Buffer.from(RAW_PAYLOAD), '')).toBe(false);
  });

  it('does not reconstruct HMAC input with JSON.stringify', () => {
    const original = '{"b": 1, "a": 2}';
    const parsed = JSON.parse(original);
    const reconstructed = JSON.stringify(parsed);
    expect(reconstructed).not.toBe(original);
    const fromObject = extractRazorpayWebhookRawBody({ body: parsed });
    expect(fromObject).toBeNull();
    const fromRaw = extractRazorpayWebhookRawBody({
      rawBody: Buffer.from(original),
      body: parsed,
    });
    expect(fromRaw?.toString('utf8')).toBe(original);
  });
});

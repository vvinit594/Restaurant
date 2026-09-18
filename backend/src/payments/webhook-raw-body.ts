/**
 * Collect Razorpay webhook bytes for HMAC.
 * Never reconstruct JSON with JSON.stringify — Razorpay signs the original bytes.
 */
export function extractRazorpayWebhookRawBody(req: {
  rawBody?: Buffer;
  body?: unknown;
}): Buffer | null {
  if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
    return req.rawBody;
  }
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    return Buffer.from(req.body, 'utf8');
  }
  return null;
}

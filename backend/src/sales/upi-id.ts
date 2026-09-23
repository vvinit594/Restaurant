import { BadRequestException } from '@nestjs/common';

/**
 * UPI VPA: local part @ handle. Empty is allowed (payout destination is optional).
 * Handles differ by bank, so this only rejects spaces and malformed values.
 */
const UPI_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function normalizeUpiId(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (/\s/.test(value)) {
    throw new BadRequestException('UPI ID cannot contain spaces.');
  }
  if (!UPI_ID_PATTERN.test(value)) {
    throw new BadRequestException('Enter a valid UPI ID such as name@upi.');
  }
  return value;
}

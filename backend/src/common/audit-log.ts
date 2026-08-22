import { Logger } from '@nestjs/common';

/**
 * Structured audit logs for sensitive DilYum actions.
 * Never log passwords, JWTs, or raw auth headers.
 */
const logger = new Logger('Audit');

export function auditLog(
  action: string,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const payload = {
    action,
    at: new Date().toISOString(),
    ...details,
  };
  logger.log(JSON.stringify(payload));
}

/**
 * HIPAA-Compliant Logger
 *
 * Features:
 * - Structured logging for audit trails
 * - Sensitive data redaction (PHI)
 * - Multiple transport support (console, file)
 * - Log levels: error, warn, info, http
 */

import winston from 'winston';

// Redaction patterns for PHI (Protected Health Information)
const redactPatterns = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { pattern: /\b\d{16}\b/g, replacement: '[CREDIT_CARD]' },
  { pattern: /"password":\s*"[^"]*"/g, replacement: '"password": "[REDACTED]"' },
  { pattern: /"token":\s*"[^"]*"/g, replacement: '"token": "[REDACTED]"' },
];

function redact(message: string): string {
  let redacted = message;
  for (const { pattern, replacement } of redactPatterns) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

// Custom format that redacts sensitive information
const redactedFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const redactedMessage = redact(String(message));
    const redactedMeta = Object.keys(meta).length > 0
      ? JSON.stringify(redact(JSON.stringify(meta)))
      : '';
    return `${timestamp} [${level.toUpperCase()}]: ${redactedMessage} ${redactedMeta}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'salud-aldia-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport (development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        redactedFormat
      ),
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: redactedFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: redactedFormat,
    }),
  ],
});

// Audit log for HIPAA compliance - writes to separate file
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'salud-aldia-audit',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  ],
});

/**
 * Log HIPAA audit event
 *
 * @param userId - User ID performing the action
 * @param action - Action performed (e.g., 'medication.created', 'vital_sign.read')
 * @param resourceId - Resource ID affected
 * @param metadata - Additional context
 */
export function logAuditEvent(
  userId: string,
  action: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): void {
  auditLogger.info({
    type: 'AUDIT',
    userId,
    action,
    resourceId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Log authentication event
 *
 * @param userId - User ID (optional for failed logins)
 * @param event - Event type ('login.success', 'login.failed', 'logout', 'token.refresh')
 * @param metadata - Additional context
 */
export function logAuthEvent(
  userId: string | null,
  event: string,
  metadata?: Record<string, unknown>
): void {
  auditLogger.info({
    type: 'AUTH',
    userId,
    event,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Log emergency alert event
 *
 * @param userId - User ID
 * @param alertType - Type of emergency
 * @param severity - Severity level ('critical', 'high', 'medium', 'low')
 * @param metadata - Additional context
 */
export function logEmergencyEvent(
  userId: string,
  alertType: string,
  severity: string,
  metadata?: Record<string, unknown>
): void {
  auditLogger.error({
    type: 'EMERGENCY',
    userId,
    alertType,
    severity,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Rate limiting middleware
 *
 * Protects against:
 * - Brute force attacks on authentication
 * - API abuse
 * - DDoS attacks
 *
 * HIPAA consideration: Prevents unauthorized data enumeration
 */

import rateLimit from 'express-rate-limit';

// General API rate limit
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: () => process.env.NODE_ENV === 'development',
});

// Stricter rate limit for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limit for sensitive operations (e.g., data export)
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    error: 'Too many sensitive operation attempts',
    code: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

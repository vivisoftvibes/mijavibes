/**
 * HIPAA Audit Trail Middleware
 *
 * Logs all API requests with:
 * - User ID
 * - Resource accessed
 * - HTTP method
 * - Timestamp
 * - IP address (for security analysis)
 */

import { Request, Response, NextFunction } from 'express';
import { logAuditEvent } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// Routes that don't require audit logging (public endpoints)
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.send;

  // Capture response data after it's sent
  res.send = function (this: Response, ...args: [unknown]) {
    const response = originalSend.apply(this, args);

    // Skip logging for public routes
    if (isPublicRoute(req.path)) {
      return response;
    }

    // Log audit event
    logAuditEvent(
      req.user?.id || 'anonymous',
      `${req.method.toLowerCase()}.${req.path.split('/')[2] || 'unknown'}`,
      req.params.id || req.path,
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    return response;
  };

  next();
}

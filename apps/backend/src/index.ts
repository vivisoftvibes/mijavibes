/**
 * SaludAlDía Backend API
 *
 * HIPAA Compliance Notes:
 * - All API requests are logged with audit trail
 * - PHI (Protected Health Information) is encrypted at rest
 * - Access logs include user ID, timestamp, and resource accessed
 * - Rate limiting prevents unauthorized enumeration
 * - Input validation prevents injection attacks
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { authRouter } from './routes/auth';
import { medicationRouter } from './routes/medications';
import { vitalSignsRouter } from './routes/vitalSigns';
import { healthRouter } from './routes/health';
import { caregiverRouter } from './routes/caregivers';
import { emergencyRouter } from './routes/emergency';
import { statsRouter } from './routes/stats';
import { pharmacyRouter } from './routes/pharmacy';
import { pharmacyRefillRouter } from './routes/pharmacyRefill';
import { telemedicineRouter } from './routes/telemedicine';
import { appointmentsRouter } from './routes/appointments';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS configuration - restrict to known origins in production
const corsOptions = {
  origin: NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://salud-aldia.com']
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging (HIPAA audit trail)
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.http(message.trim()),
  },
}));

// Custom request logger for HIPAA compliance
app.use(requestLogger);

// Rate limiting (prevents brute force attacks)
app.use(rateLimiter);

// Health check endpoint (no auth required)
app.use('/api/health', healthRouter);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/medications', medicationRouter);
app.use('/api/vital-signs', vitalSignsRouter);
app.use('/api/caregivers', caregiverRouter);
app.use('/api/emergency', emergencyRouter);
app.use('/api/stats', statsRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/pharmacy-refill', pharmacyRefillRouter);
app.use('/api/telemedicine', telemedicineRouter);
app.use('/api/appointments', appointmentsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
httpServer.listen(PORT, () => {
  logger.info(`SaludAlDía API server started on port ${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});

export { app, httpServer };

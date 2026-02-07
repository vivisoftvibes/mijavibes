/**
 * Test setup file
 * Configures test environment and mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'error';

// Mock console to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Mock database connection
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: {
    query: jest.fn(),
    end: jest.fn(),
  },
  healthCheck: jest.fn().mockResolvedValue(true),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    http: jest.fn(),
  },
  auditLogger: {
    info: jest.fn(),
  },
  logAuditEvent: jest.fn(),
  logAuthEvent: jest.fn(),
  logEmergencyEvent: jest.fn(),
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
}));

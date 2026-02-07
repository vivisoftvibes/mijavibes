/**
 * Authentication routes
 *
 * Endpoints:
 * POST /register - User registration
 * POST /login - User login
 * POST /logout - User logout
 * POST /refresh - Refresh access token
 * GET /me - Get current user profile
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, generateToken, generateRefreshToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthService } from '../services/AuthService';
import { validateBody } from '../middleware/validator';
import { logAuthEvent } from '../utils/logger';

export const authRouter = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Initialize service
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Register a new user
 */
authRouter.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, phone, dateOfBirth, emergencyContactName, emergencyContactPhone } =
      req.body;

    const user = await authService.register({
      email,
      password,
      name,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      emergencyContactName,
      emergencyContactPhone,
    });

    const accessToken = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    logAuthEvent(user.id, 'register.success', { email });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, caregiverPatients } = await authService.login(email, password);

    const accessToken = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    logAuthEvent(user.id, 'login.success', { email });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      caregiverPatients,
      accessToken,
      refreshToken,
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
authRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const user = await authService.refreshToken(refreshToken);

    const accessToken = generateToken(user.id, user.email);

    logAuthEvent(user.id, 'token.refresh', {});

    res.json({ accessToken });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const profile = await authService.getProfile(userId);

    res.json(profile);
  })
);

/**
 * PUT /api/auth/me
 * Update current user profile
 */
authRouter.put(
  '/me',
  authenticate,
  validateBody(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const updatedUser = await authService.updateProfile(userId, req.body);

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
    });
  })
);

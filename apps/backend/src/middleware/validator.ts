/**
 * Request validation middleware using Zod
 *
 * Provides:
 * - Schema-based validation
 * - Consistent error responses
 * - Input sanitization (HIPAA requirement)
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Validate request body against Zod schema
 */
export function validateBody(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError('Request body validation failed');
      }
      next(error);
    }
  };
}

/**
 * Validate request query parameters against Zod schema
 */
export function validateQuery(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError('Query parameters validation failed');
      }
      next(error);
    }
  };
}

/**
 * Validate request parameters against Zod schema
 */
export function validateParams(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError('URL parameters validation failed');
      }
      next(error);
    }
  };
}

/**
 * AuthService unit tests
 * Characterization tests for authentication behavior
 */

import { AuthService } from '../../services/AuthService';
import { query, queryOne } from '../../database/connection';
import { ValidationError, UnauthorizedError, NotFoundError } from '../../middleware/errorHandler';

// Mock database
jest.mock('../../database/connection');

describe('AuthService - Characterization Tests', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('characterize: should create a new user with hashed password', async () => {
      const input = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
        phone: '+1234567890',
      };

      (queryOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'user-123',
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: 'patient',
      });

      const result = await authService.register(input);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(input.email);
      expect(result.name).toBe(input.name);
    });

    it('characterize: should throw ValidationError if user already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'Test User',
      };

      (queryOne as jest.Mock).mockResolvedValueOnce({ id: 'existing-user' });

      await expect(authService.register(input)).rejects.toThrow(ValidationError);
    });
  });

  describe('login', () => {
    it('characterize: should return user and caregiver patients on successful login', async () => {
      const email = 'test@example.com';
      const password = 'Password123!';

      (queryOne as jest.Mock)
        .mockResolvedValueOnce({
          id: 'user-123',
          email,
          name: 'Test User',
          password_hash: '$2a$12$hashedpassword', // Mock hash
          role: 'caregiver',
        })
        .mockResolvedValueOnce([
          { id: 'patient-1', name: 'Patient One' },
        ]);

      // Mock bcrypt.compare
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValueOnce(true);

      const result = await authService.login(email, password);

      expect(result.user).toHaveProperty('id');
      expect(result.user.email).toBe(email);
      expect(result.caregiverPatients).toEqual([
        { id: 'patient-1', name: 'Patient One' },
      ]);
    });

    it('characterize: should throw UnauthorizedError for invalid credentials', async () => {
      (queryOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(authService.login('test@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getProfile', () => {
    it('characterize: should return user profile', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        phone: '+1234567890',
        role: 'patient',
      };

      (queryOne as jest.Mock).mockResolvedValueOnce(mockUser);

      const result = await authService.getProfile(userId);

      expect(result).toEqual(mockUser);
    });

    it('characterize: should throw NotFoundError for non-existent user', async () => {
      (queryOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(authService.getProfile('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('characterize: should update user profile fields', async () => {
      const userId = 'user-123';
      const updates = {
        name: 'Updated Name',
        phone: '+9876543210',
      };

      (queryOne as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        ...updates,
        role: 'patient',
      });

      const result = await authService.updateProfile(userId, updates);

      expect(result.name).toBe(updates.name);
      expect(result.phone).toBe(updates.phone);
    });
  });
});

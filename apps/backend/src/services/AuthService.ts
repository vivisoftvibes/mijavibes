/**
 * Authentication Service
 *
 * Handles user registration, login, and profile management
 */

import bcrypt from 'bcryptjs';
import { query, queryOne } from '../database/connection';
import { UnauthorizedError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { verifyRefreshToken } from '../middleware/auth';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  dateOfBirth?: Date;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  dateOfBirth?: Date;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<User> {
    // Check if user already exists
    const existingUser = await queryOne<User>(
      'SELECT id, email FROM users WHERE email = $1',
      [input.email]
    );

    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    // Create user
    const user = await queryOne<User>(
      `INSERT INTO users (email, password_hash, name, phone, date_of_birth, emergency_contact_name, emergency_contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, phone, role, date_of_birth, emergency_contact_name, emergency_contact_phone`,
      [
        input.email,
        passwordHash,
        input.name,
        input.phone || null,
        input.dateOfBirth || null,
        input.emergencyContactName || null,
        input.emergencyContactPhone || null,
      ]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: User; caregiverPatients: User[] }> {
    // Get user with password hash
    const user = await queryOne<User & { password_hash: string }>(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // If user is a caregiver, get their patients
    let caregiverPatients: User[] = [];
    if (user.role === 'caregiver') {
      caregiverPatients = await query<User>(
        `SELECT u.id, u.name, u.email, u.phone
         FROM users u
         JOIN caregiver_relationships cr ON cr.patient_id = u.id
         WHERE cr.caregiver_id = $1`,
        [user.id]
      );
    }

    // Return user without password hash
    const { password_hash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      caregiverPatients,
    };
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<User> {
    const user = await queryOne<User>(
      `SELECT id, email, name, phone, role, date_of_birth, emergency_contact_name, emergency_contact_phone
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.emergencyContactName !== undefined) {
      fields.push(`emergency_contact_name = $${paramIndex++}`);
      values.push(updates.emergencyContactName);
    }
    if (updates.emergencyContactPhone !== undefined) {
      fields.push(`emergency_contact_phone = $${paramIndex++}`);
      values.push(updates.emergencyContactPhone);
    }

    if (fields.length === 0) {
      return this.getProfile(userId);
    }

    values.push(userId);

    const user = await queryOne<User>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, phone, role, date_of_birth, emergency_contact_name, emergency_contact_phone`,
      values
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Verify refresh token and get user
   */
  async refreshToken(refreshToken: string): Promise<User> {
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await queryOne<User>(
      `SELECT id, email, name, phone, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [payload.userId]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }
}

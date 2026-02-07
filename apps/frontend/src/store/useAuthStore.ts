/**
 * Authentication Store
 *
 * Zustand store for managing authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse } from '../types';
import { authService, isAuthenticated, clearStorage } from '../services/api';

interface AuthState {
  user: User | null;
  caregiverPatients: Array<{ id: string; name: string; email: string; phone?: string }>;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    dateOfBirth?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      caregiverPatients: [],
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: async () => {
        set({ isLoading: true });

        try {
          const hasToken = await isAuthenticated();

          if (hasToken) {
            const profile = await authService.getProfile();
            set({ user: profile });
          }

          set({ isInitialized: true, isLoading: false });
        } catch (error) {
          // Token might be expired, clear storage
          await clearStorage();
          set({ user: null, isInitialized: true, isLoading: false });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(email, password);
          set({
            user: response.user,
            caregiverPatients: response.caregiverPatients || [],
            isLoading: false,
          });
          return response;
        } catch (error: any) {
          set({
            error: error.error || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.register(data);
          set({
            user: response.user,
            isLoading: false,
          });
          return response;
        } catch (error: any) {
          set({
            error: error.error || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        await authService.logout();
        set({
          user: null,
          caregiverPatients: [],
          isLoading: false,
        });
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const updatedUser = await authService.updateProfile(data);
          set({
            user: updatedUser,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.error || 'Update failed',
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'salud-aldia-auth',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
    }
  )
);

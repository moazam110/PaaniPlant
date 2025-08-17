"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'super_admin' | 'admin';
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const router = useRouter();
  const { toast } = useToast();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('superAdminToken');
        const userData = localStorage.getItem('superAdminUser');
        
        if (token && userData) {
          const user = JSON.parse(userData);
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = useCallback((user: User, token: string) => {
    try {
      localStorage.setItem('superAdminToken', token);
      localStorage.setItem('superAdminUser', JSON.stringify(user));
      
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.name}!`,
      });

      return true;
    } catch (error) {
      console.error('Error during login:', error);
      toast({
        title: "Login Error",
        description: "Failed to save login information",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Logout function
  const logout = useCallback(() => {
    try {
      localStorage.removeItem('superAdminToken');
      localStorage.removeItem('superAdminUser');
      
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });

      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });

      router.push('/admin/super/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [router, toast]);

  // Check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }, []);

  // Auto-logout on token expiration
  useEffect(() => {
    if (authState.token && isTokenExpired(authState.token)) {
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please login again.",
        variant: "destructive",
      });
      logout();
    }
  }, [authState.token, isTokenExpired, logout, toast]);

  // Get auth headers for API calls
  const getAuthHeaders = useCallback((): HeadersInit => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authState.token}`,
    };
  }, [authState.token]);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    isTokenExpired,
  };
}

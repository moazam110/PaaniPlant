const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Types
export interface SuperAdminUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  _id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  createdBy: string;
  canModifyCredentials: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLog {
  _id: string;
  timestamp: string;
  user: string;
  action: string;
  ipAddress: string;
  type: string;
  severity: string;
  details: string;
  metadata?: any;
}

export interface SecurityEvent {
  _id: string;
  timestamp: string;
  type: string;
  user?: string;
  ipAddress: string;
  details: string;
  severity: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DashboardMetrics {
  systemStats: {
    totalAdmins: number;
    activeAdmins: number;
    suspendedAdmins: number;
    failedLogins: number;
    suspiciousActivities: number;
    lastSecurityScan: string;
  };
  activityMetrics: {
    newAdmins: number;
    systemLogins: number;
    actionsToday: number;
  };
}

export interface CreateAdminRequest {
  email: string;
  username: string;
  password: string;
  name: string;
}

export interface CreateAdminResponse {
  message: string;
  admin: AdminUser;
  credentials: {
    username: string;
    password: string;
  };
}

// API Service Class
class SuperAdminAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Check if token is expired
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }

  // Validate token before making requests
  private validateToken(): boolean {
    if (!this.token) return false;
    if (this.isTokenExpired(this.token)) {
      this.token = null;
      return false;
    }
    return true;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Skip token validation for authentication endpoints
    if (!endpoint.includes('/auth/') && !this.validateToken()) {
      throw new Error('Token expired or invalid. Please login again.');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: this.getHeaders(),
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        this.token = null;
        throw new Error('Authentication failed. Please login again.');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication
  async superAdminSetup(data: CreateAdminRequest): Promise<{ message: string; user: any }> {
    return this.request('/api/auth/super-admin-setup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async superAdminLogin(username: string, password: string): Promise<{
    message: string;
    token: string;
    user: any;
  }> {
    const response = await this.request('/api/auth/super-admin-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // Set token for future requests
    this.setToken(response.token);
    return response;
  }

  // Dashboard
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.request('/api/super-admin/dashboard');
  }

  // Admin Management
  async getAdmins(): Promise<AdminUser[]> {
    return this.request('/api/super-admin/admins');
  }

  async createAdmin(data: CreateAdminRequest): Promise<CreateAdminResponse> {
    return this.request('/api/super-admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdmin(id: string, data: Partial<AdminUser>): Promise<{
    message: string;
    admin: AdminUser;
  }> {
    return this.request(`/api/super-admin/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdmin(id: string): Promise<{ message: string }> {
    return this.request(`/api/super-admin/admins/${id}`, {
      method: 'DELETE',
    });
  }

  // System Logs
  async getSystemLogs(params?: {
    type?: string;
    severity?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: SystemLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/api/super-admin/logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async exportLogs(params: {
    type?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    message: string;
    count: number;
    logs: SystemLog[];
  }> {
    return this.request('/api/super-admin/logs/export', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Security
  async getSecurityOverview(): Promise<{
    securityStats: {
      failedLogins: number;
      suspiciousIPs: number;
      bruteForceAttempts: number;
      activeSessions: number;
      lockedAccounts: number;
      passwordExpiry: number;
      blockedIPs: number;
      whitelistedIPs: number;
      recentBlocked: number;
    };
  }> {
    return this.request('/api/super-admin/security');
  }

  async getActiveSessions(): Promise<any[]> {
    return this.request('/api/super-admin/security/sessions');
  }

  async forceLogoutAll(): Promise<{ message: string }> {
    return this.request('/api/super-admin/security/force-logout-all', {
      method: 'POST',
    });
  }

  // Utility methods
  logout() {
    this.token = null;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

// Export singleton instance
export const superAdminAPI = new SuperAdminAPI();

// Export types
export type {
  SuperAdminUser,
  AdminUser,
  SystemLog,
  SecurityEvent,
  DashboardMetrics,
  CreateAdminRequest,
  CreateAdminResponse,
};

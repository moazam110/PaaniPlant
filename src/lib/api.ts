// Centralized API configuration
const getApiBaseUrl = () => {
  // Get environment variable
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  // For debugging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🔍 Client-side NEXT_PUBLIC_API_BASE_URL:', envUrl);
  }
  
  // Use environment variable if available
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback to localhost for development
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.NEXT_PUBLIC_BACKEND_PORT || '4000';
    return `http://localhost:${port}`;
  }
  
  // Throw error if no environment variable is set in production
  throw new Error('NEXT_PUBLIC_API_BASE_URL environment variable is required in production');
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  CUSTOMERS: '/api/customers',
  DELIVERY_REQUESTS: '/api/delivery-requests',
  RECURRING_REQUESTS: '/api/recurring-requests',
  DASHBOARD_METRICS: '/api/dashboard/metrics',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  NOTIFICATIONS: '/api/notifications',
  UPLOAD: '/api/upload',
} as const;
// Centralized API configuration
const getApiBaseUrl = () => {
  // For debugging
  if (typeof window !== 'undefined') {
    console.log('🔍 Client-side NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
  }
  
  // Use environment variable FIRST
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback to production URL ONLY if no environment variable is set
  return 'https://paaniplant-b.onrender.com';
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
  CUSTOMER_CREDENTIALS: '/api/customer-credentials',
  CUSTOMER_LOGIN: '/api/customer-credentials/login',
  PAYMENTS: '/api/payments',
} as const;

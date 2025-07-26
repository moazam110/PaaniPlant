// Centralized API configuration
const getApiBaseUrl = () => {
  // Production URL (when deployed)
  const PRODUCTION_URL = 'https://paani-b.onrender.com';
  
  // For debugging
  if (typeof window !== 'undefined') {
    console.log('🔍 Client-side NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
  }
  
  // Use environment variable or fallback
  // In production, prefer the environment variable, but have a backup
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  // If we have an environment variable and it's not localhost, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  
  // If we're in development and no specific production URL is set, use localhost
  if (envUrl && envUrl.includes('localhost')) {
    return envUrl;
  }
  
  // Default to production URL if no environment variable is set
  return PRODUCTION_URL;
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
  DASHBOARD_METRICS: '/api/dashboard/metrics',
} as const;
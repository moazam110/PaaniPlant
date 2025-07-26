// Centralized API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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
// Server-side API utilities for Next.js Server Components
// These functions run on the server and fetch data before sending to client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function fetchDashboardMetrics(day?: string, month?: string, year?: string) {
  let url = `${API_BASE_URL}/api/dashboard/metrics`;
  const params: string[] = [];
  
  if (day && month && year) {
    params.push(`day=${day}`, `month=${month}`, `year=${year}`);
  } else if (month && year) {
    params.push(`month=${month}`, `year=${year}`);
  } else if (year) {
    params.push(`year=${year}`);
  }
  
  if (params.length) {
    url += `?${params.join('&')}`;
  }
  
  const res = await fetch(url, {
    next: { revalidate: 5 } // Revalidate every 5 seconds
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch metrics: ${res.status}`);
  }
  
  return res.json();
}

export async function fetchDeliveryRequests(page: number = 1, limit: number = 100, filters?: {
  status?: string | string[];
  priority?: string;
  customerId?: string;
  search?: string;
}) {
  let url = `${API_BASE_URL}/api/delivery-requests?page=${page}&limit=${limit}`;
  
  if (filters) {
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach(s => url += `&status=${s}`);
      } else {
        url += `&status=${filters.status}`;
      }
    }
    if (filters.priority) url += `&priority=${filters.priority}`;
    if (filters.customerId) url += `&customerId=${filters.customerId}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
  }
  
  const res = await fetch(url, {
    next: { revalidate: 5 }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch delivery requests: ${res.status}`);
  }
  
  const result = await res.json();
  // PHASE 4: Handle paginated response - return data array for backward compatibility
  return result.data || result;
}

export async function fetchCustomers(page: number = 1, limit: number = 100, filters?: {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  paymentType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  let url = `${API_BASE_URL}/api/customers?page=${page}&limit=${limit}`;
  
  if (filters) {
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.minPrice) url += `&minPrice=${filters.minPrice}`;
    if (filters.maxPrice) url += `&maxPrice=${filters.maxPrice}`;
    if (filters.paymentType) url += `&paymentType=${filters.paymentType}`;
    if (filters.sortBy) url += `&sortBy=${filters.sortBy}`;
    if (filters.sortOrder) url += `&sortOrder=${filters.sortOrder}`;
  }
  
  const res = await fetch(url, {
    next: { revalidate: 5 }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch customers: ${res.status}`);
  }
  
  const result = await res.json();
  // PHASE 4: Handle paginated response - return data array for backward compatibility
  return result.data || result;
}


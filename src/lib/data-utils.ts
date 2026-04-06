// PHASE 5: Centralized data utility functions
// Removes duplicate hash function implementations across components

import type { DeliveryRequest } from '@/types';

/**
 * Creates a hash string from dashboard metrics data for change detection
 * Used to detect if data has actually changed before updating state
 * 
 * @param data - Dashboard metrics object
 * @returns Hash string representing the data state
 */
export const createDashboardDataHash = (data: any): string => {
  try {
    return `${data?.totalCustomers || 0}-${data?.pendingRequests || 0}-${data?.deliveries || 0}-${data?.totalCans || 0}-${data?.totalAmountGenerated || 0}-${data?.totalCashAmountGenerated || 0}`;
  } catch (error) {
    console.error('Error creating dashboard data hash:', error);
    return 'error-hash';
  }
};

/**
 * Creates a hash string from delivery requests array for change detection
 * Used to detect if requests have actually changed before updating state
 * 
 * @param requests - Array of delivery requests
 * @returns Hash string representing the requests state
 */
export const createDeliveryRequestsHash = (requests: DeliveryRequest[]): string => {
  try {
    if (!Array.isArray(requests)) {
      return 'no-requests';
    }
    return requests.map(req => 
      `${req?._id || req?.requestId || 'unknown'}-${req?.status || 'unknown'}-${req?.requestedAt || 'unknown'}`
    ).join('|');
  } catch (error) {
    console.error('Error creating delivery requests hash:', error);
    return 'error-hash';
  }
};

/**
 * Generic data hash creator - handles arrays, objects, and primitives
 * 
 * @param data - Any data to create hash from
 * @returns Hash string
 */
export const createDataHash = (data: any): string => {
  if (Array.isArray(data)) {
    return data.map(item => 
      `${item._id || item.id || 'unknown'}-${item.status || 'unknown'}-${item.updatedAt || item.createdAt || 'unknown'}`
    ).join('|');
  }
  
  if (typeof data === 'object' && data !== null) {
    return `${data?.totalCustomers || 0}-${data?.pendingRequests || 0}-${data?.deliveries || 0}-${data?.totalCans || 0}-${data?.totalAmountGenerated || 0}-${data?.totalCashAmountGenerated || 0}`;
  }
  
  return String(data);
};


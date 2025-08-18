
"use client";

/**
 * Staff Dashboard with Silent Background Updates
 * 
 * This component implements a silent refresh system that updates data in the background
 * every 3 seconds without causing visual page reloads or disrupting the user experience.
 * 
 * Key Features:
 * - Silent background data updates every 3 seconds
 * - Smart change detection to prevent unnecessary re-renders
 * - Optimistic updates for smooth status transitions
 * - Resource optimization when page is not visible
 * - Visual indicators for live updates without disruption
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button as UIButton } from '@/components/ui/button';
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import type { DeliveryRequest } from '@/types';
import Header from '@/components/shared/Header';
import StaffDashboardMetrics from '@/components/dashboard/StaffDashboardMetrics';
import RequestQueue from '@/components/requests/RequestQueue';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';


export default function StaffPage() {
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [previousRequestCount, setPreviousRequestCount] = useState(0);
  const [authUser, setAuthUser] = useState<any | null>(null);
  
  // Enhanced optimistic updates and silent refresh system
  const optimisticRef = useRef<Map<string, { status: DeliveryRequest['status']; expires: number }>>(new Map());
  const fetchInProgressRef = useRef<boolean>(false);
  const lastUpdateRef = useRef<number>(0);
  const currentFetchAbortRef = useRef<AbortController | null>(null);
  
  // Silent refresh system - prevents visual page reloads
  const silentRefreshRef = useRef<boolean>(false);
  const lastDataHashRef = useRef<string>('');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store the fetch function in a ref to avoid dependency issues
  const fetchDeliveryRequestsRef = useRef<typeof fetchDeliveryRequests>();

  const { toast } = useToast();
  const router = useRouter();

  // Utility function to create a hash of delivery requests for change detection
  const createDataHash = useCallback((requests: DeliveryRequest[]): string => {
    return requests.map(req => 
      `${req._id || req.requestId}-${req.status}-${req.requestedAt}`
    ).join('|');
  }, []);

  // No authentication required - direct access granted
  useEffect(() => {
    setAuthUser({
      uid: 'staff_direct_access',
      email: 'staff@paani.com',
      userType: 'staff',
      loginTime: new Date().toISOString()
    });
    console.log('✅ Staff access granted (no authentication required)');
  }, []);

  const handleSignOut = () => {
    // No authentication required - just redirect to login page
    console.log('✅ Staff signed out (redirecting to login)');
    router.push('/staff/login');
  };

  useEffect(() => {
    // Check backend connection
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.HEALTH), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        setIsBackendConnected(response.ok);
      } catch (err) {
        console.error('Backend connection error:', err);
        setIsBackendConnected(false);
      }
    };

    checkBackendConnection();
    const interval = setInterval(checkBackendConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // Enhanced fetch function with silent updates to prevent visual page reloads
  const fetchDeliveryRequests = useCallback(async (isSilentRefresh: boolean = false) => {
    if (fetchInProgressRef.current) return;
    
    fetchInProgressRef.current = true;
    try {
      const controller = new AbortController();
      currentFetchAbortRef.current = controller;
      
      const res = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS), { 
        signal: controller.signal 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      // Apply optimistic overrides efficiently
      const now = Date.now();
      const withOptimistic: DeliveryRequest[] = data.map((req: DeliveryRequest) => {
        const key = String((req as any)._id || (req as any).requestId || (req as any).id || '');
        const ov = optimisticRef.current.get(key);
        if (ov && ov.expires > now) {
          return { ...req, status: ov.status } as DeliveryRequest;
        }
        return req;
      });

      // Clean up expired optimistic entries
      for (const [k, v] of optimisticRef.current.entries()) {
        if (v.expires <= now) optimisticRef.current.delete(k);
      }

      // Create hash of new data to detect real changes
      const newDataHash = createDataHash(withOptimistic);
      const hasRealChanges = newDataHash !== lastDataHashRef.current;
      
      // Only update state if there are real changes or it's not a silent refresh
      if (hasRealChanges || !isSilentRefresh) {
        // Calculate pending count for metrics
        const currentPendingCount = withOptimistic.filter((req: DeliveryRequest) => 
          req.status === 'pending' || req.status === 'pending_confirmation'
        ).length;
        
        if (currentPendingCount !== previousRequestCount) {
          setPreviousRequestCount(currentPendingCount);
          console.log(`📊 Request count updated: ${currentPendingCount} pending requests`);
        }

        // Update delivery requests with smooth transition
        setDeliveryRequests(prevRequests => {
          // If it's a silent refresh and no real changes, return previous state to prevent re-renders
          if (isSilentRefresh && !hasRealChanges) {
            return prevRequests;
          }
          
          // Update the hash reference
          lastDataHashRef.current = newDataHash;
          
          // Return new data for real changes
          return withOptimistic;
        });
        
        // Only set loading to false for non-silent refreshes
        if (!isSilentRefresh) {
          setIsLoading(false);
        }
      }
      
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return; // Ignore aborted fetch errors silently
      }
      console.error('Error fetching delivery requests:', err);
      
      // Only show errors for non-silent refreshes
      if (!isSilentRefresh) {
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Unable to fetch delivery requests. Check if backend is running.",
        });
      }
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [toast, createDataHash]); // Removed previousRequestCount dependency to prevent function recreation

  // Store the function in ref after it's defined
  useEffect(() => {
    fetchDeliveryRequestsRef.current = fetchDeliveryRequests;
  }, [fetchDeliveryRequests]);

  // Stable polling setup - only runs once on mount
  useEffect(() => {
    // Prevent multiple setups
    if (refreshIntervalRef.current) {
      console.log('🔄 Polling already set up, skipping duplicate setup');
      return;
    }
    
    console.log('🔄 Initializing staff dashboard polling system');
    
    // Initial fetch (non-silent)
    setIsLoading(true);
    if (fetchDeliveryRequestsRef.current) {
      fetchDeliveryRequestsRef.current(false);
    }

    // Initialize previous count after first successful fetch
    let initializationAttempts = 0;
    const initializePreviousCount = () => {
      if (deliveryRequests.length > 0 || initializationAttempts >= 3) {
        const currentRequests = deliveryRequests.filter(req => 
          req.status === 'pending' || req.status === 'pending_confirmation'
        );
        setPreviousRequestCount(currentRequests.length);
        console.log('📊 Initial pending request count set to:', currentRequests.length);
      } else {
        initializationAttempts++;
        setTimeout(initializePreviousCount, 2000);
      }
    };
    
    setTimeout(initializePreviousCount, 3000);

    // Enhanced silent polling: every 3 seconds with silent background updates
    // This interval is set up once and never changes
    console.log('🔄 Setting up stable polling interval (runs once on mount)');
    refreshIntervalRef.current = setInterval(() => {
      // Use silent refresh to prevent visual page reloads
      if (fetchDeliveryRequestsRef.current) {
        console.log('🔄 Silent background refresh triggered');
        fetchDeliveryRequestsRef.current(true);
      } else {
        console.warn('⚠️ fetchDeliveryRequestsRef.current is not available');
      }
    }, 3000);

    // Cleanup interval on unmount
    return () => {
      console.log('🔄 Cleaning up staff dashboard polling system');
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array - only runs once on mount

  // Function to manually trigger a silent refresh (useful for external updates)
  const triggerSilentRefresh = useCallback(() => {
    if (!fetchInProgressRef.current && fetchDeliveryRequestsRef.current) {
      fetchDeliveryRequestsRef.current(true);
    }
  }, []); // No dependencies needed since we use ref

  // Pause/resume silent refreshes when page is not visible (save resources)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause silent refreshes
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
          console.log('🔄 Silent refreshes paused (page hidden)');
        }
      } else {
        // Page is visible, resume silent refreshes
        if (!refreshIntervalRef.current) {
          refreshIntervalRef.current = setInterval(() => {
            if (fetchDeliveryRequestsRef.current) {
              fetchDeliveryRequestsRef.current(true);
            }
          }, 3000);
          console.log('🔄 Silent refreshes resumed (page visible)');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // Empty dependency array - only runs once

  const handleMarkAsDone = useCallback(async (requestId: string) => {
    try {
      const currentRequest = deliveryRequests.find(req => (req._id || req.requestId) === requestId);
      if (!currentRequest) return;

      let newStatus = 'delivered';
      if (currentRequest.status === 'pending' || currentRequest.status === 'pending_confirmation') {
        newStatus = 'processing';
      } else if (currentRequest.status === 'processing') {
        newStatus = 'delivered';
      }

      // Enhanced optimistic update: update local state immediately with smooth transition
      const optimisticKey = String(currentRequest._id || currentRequest.requestId || '');
      optimisticRef.current.set(optimisticKey, { 
        status: newStatus as DeliveryRequest['status'], 
        expires: Date.now() + 8000 
      });
      
      // Update local state immediately with smooth transition
      setDeliveryRequests(prev => prev.map(req =>
        (req._id || req.requestId) === requestId ? { ...req, status: newStatus as DeliveryRequest['status'] } : req
      ));

      const actualRequestId = currentRequest._id || currentRequest.requestId || (currentRequest as any).id;
      
      // Abort any in-flight polling request
      try { 
        currentFetchAbortRef.current?.abort(); 
      } catch {}

      const response = await fetch(buildApiUrl(`api/delivery-requests/${actualRequestId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedRequest = await response.json();
        // Confirm and clear optimistic override
        optimisticRef.current.delete(optimisticKey);
        setDeliveryRequests(prev => prev.map(req =>
          (req._id || req.requestId) === requestId ? { ...req, ...updatedRequest } : req
        ));
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error("Error updating request status:", error);
      // Revert optimistic update on error
      setDeliveryRequests(prev => prev.map(req => {
        if ((req._id || req.requestId) === requestId) {
          const prevStatus = req.status === 'processing' ? 'pending' : (req.status === 'delivered' ? 'processing' : req.status);
          return { ...req, status: prevStatus } as DeliveryRequest;
        }
        return req;
      }));
      
      // Remove optimistic entry
      const optimisticKey = String(requestId);
      optimisticRef.current.delete(optimisticKey);
      
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update the request status. Please try again.",
      });
    }
  }, [deliveryRequests, toast]);



  if (isLoading || !authUser) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header title="Staff Delivery Interface" />
            <main className="flex-grow p-4 md:p-8">
                <Skeleton className="h-24 w-full mb-6 bg-muted/50" /> 
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="bg-card shadow-md">
                            <CardHeader><Skeleton className="h-6 w-3/4 bg-muted/50" /></CardHeader>
                            <CardContent><Skeleton className="h-16 w-full bg-muted/50" /></CardContent>
                        </Card>
                    ))}
                </div>
            </main>
            <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30">
              <Skeleton className="h-10 w-32 mx-auto bg-muted/50" />
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow">
        {!isBackendConnected && (
          <div className="mx-4 mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">⚠️ Backend server is not connected</p>
                <p className="text-xs mt-1">
                  Make sure the backend is running on port 5000. 
                  <a href={buildApiUrl(API_ENDPOINTS.HEALTH)} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    Test backend health
                  </a>
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="ml-4 text-yellow-700 border-yellow-400 hover:bg-yellow-200"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        )}
        
        {/* Subtle background update indicator */}
        <div className="mx-4 mt-2 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live updates enabled • Data refreshes every 3 seconds</span>
          </div>
        </div>
        <div className="px-2 py-1">
          <div className="flex items-center justify-between">
            <StaffDashboardMetrics 
              requests={deliveryRequests} 
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by address:</span>
              <UIButton
                type="button"
                variant={addressSortOrder === 'asc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddressSortOrder(prev => (prev === 'asc' ? null : 'asc'))}
                title="Ascending"
              >
                <ArrowUpAZ className="h-4 w-4 mr-1" /> Asc
              </UIButton>
              <UIButton
                type="button"
                variant={addressSortOrder === 'desc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddressSortOrder(prev => (prev === 'desc' ? null : 'desc'))}
                title="Descending"
              >
                <ArrowDownAZ className="h-4 w-4 mr-1" /> Desc
              </UIButton>
            </div>
          </div>
        </div>
        <div className="px-2">
          <RequestQueue 
            requests={deliveryRequests} 
            onMarkAsDone={handleMarkAsDone} 
            addressSortOrder={addressSortOrder} 
          />
        </div>
      </main>
      
      {/* Bottom Sign Out Button */}
      <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30 flex justify-center">
        <Button 
          variant="outline" 
          onClick={handleSignOut} 
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {authUser?.userType === 'admin_staff' ? 'Close Staff Access' : 'Sign Out'}
        </Button>
      </div>
    </div>
  );
}



"use client";

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
  
  // Optimized optimistic updates with single ref
  const optimisticRef = useRef<Map<string, { status: DeliveryRequest['status']; expires: number }>>(new Map());
  const fetchInProgressRef = useRef<boolean>(false);
  const lastUpdateRef = useRef<number>(0);
  const currentFetchAbortRef = useRef<AbortController | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  // Memoized request counts to prevent unnecessary re-renders
  const requestCounts = useMemo(() => {
    const pending = deliveryRequests.filter(req => 
      req.status === 'pending' || req.status === 'pending_confirmation'
    ).length;
    const processing = deliveryRequests.filter(req => req.status === 'processing').length;
    const urgent = deliveryRequests.filter(req => 
      req.priority === 'urgent' && 
      (req.status === 'pending' || req.status === 'pending_confirmation' || req.status === 'processing')
    ).length;
    
    return { pending, processing, urgent };
  }, [deliveryRequests]);

  // Memoized sorted requests to prevent re-sorting on every render
  const sortedRequests = useMemo(() => {
    if (!addressSortOrder) return deliveryRequests;
    
    const dir = addressSortOrder === 'asc' ? 1 : -1;
    return [...deliveryRequests].sort((a, b) => {
      const addrA = (a.address || '').toString().toLowerCase();
      const addrB = (b.address || '').toString().toLowerCase();
      
      if (addrA < addrB) return -1 * dir;
      if (addrA > addrB) return 1 * dir;
      
      // Tie-breaker: urgent first
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      
      // Final tie-breaker: time oldest first
      const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [deliveryRequests, addressSortOrder]);


  // Check staff authentication
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for regular staff session
        const authSession = localStorage.getItem('paani_auth_session');
        
        // Check for admin staff access
        const adminStaffAccess = localStorage.getItem('admin_staff_access');
        const adminSession = localStorage.getItem('paani_auth_session'); // This should be different
        
        let isAuthenticated = false;
        let userInfo = null;
        
        // Regular staff user authentication
        if (authSession) {
          try {
            const session = JSON.parse(authSession);
            if (session.userType === 'staff' && session.email === 'staff@paani.com') {
              userInfo = {
                uid: session.sessionId,
                email: session.email,
                userType: session.userType,
                loginTime: session.loginTime
              };
              isAuthenticated = true;
              console.log('✅ Staff user authentication verified');
            }
          } catch (parseError) {
            console.error('Error parsing staff session:', parseError);
            localStorage.removeItem('paani_auth_session');
          }
        }
        
        // Admin with staff access authentication
        if (!isAuthenticated && adminStaffAccess && adminSession) {
          try {
            const staffAccess = JSON.parse(adminStaffAccess);
            const adminAuth = JSON.parse(adminSession);
            
            // Verify admin has valid session and staff access
            if (adminAuth.userType === 'admin' && adminAuth.email === 'admin@paani.com' && staffAccess.sessionId) {
              userInfo = {
                uid: staffAccess.sessionId,
                email: `${adminAuth.email} (Staff Access)`,
                userType: 'admin_staff',
                loginTime: adminAuth.loginTime,
                staffAccessGranted: staffAccess.grantedAt
              };
              isAuthenticated = true;
              console.log('✅ Admin staff access verified');
            }
          } catch (parseError) {
            console.error('Error parsing admin session:', parseError);
            localStorage.removeItem('admin_staff_access');
          }
        }
        
        if (isAuthenticated && userInfo) {
          setAuthUser(userInfo);
        } else {
          // No valid authentication, redirect to login
          console.log('❌ No valid staff authentication found, redirecting to login');
          router.push('/staff/login');
        }
      } catch (error) {
        console.error('Staff auth check error:', error);
        router.push('/staff/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleSignOut = () => {
    try {
      if (authUser?.userType === 'admin_staff') {
        // Admin with staff access - only clear staff access, keep admin session
        localStorage.removeItem('admin_staff_access');
        console.log('✅ Admin staff access revoked, returning to admin dashboard');
        
        // Close current window and return to admin dashboard
        window.close();
      } else {
        // Regular staff user - clear staff session
        localStorage.removeItem('paani_auth_session');
        console.log('✅ Staff signed out successfully');
        
        // Redirect to login page
        router.push('/staff/login');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out. Please try again.');
    }
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

  // Optimized fetch function with better error handling and performance
  const fetchDeliveryRequests = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    
    // Skip fetch if we just updated (within 2 seconds)
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return;
    
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
      const currentTime = Date.now();
      const withOptimistic: DeliveryRequest[] = data.map((req: DeliveryRequest) => {
        const key = String((req as any)._id || (req as any).requestId || (req as any).id || '');
        const ov = optimisticRef.current.get(key);
        if (ov && ov.expires > currentTime) {
          return { ...req, status: ov.status } as DeliveryRequest;
        }
        return req;
      });

      // Clean up expired optimistic entries
      for (const [k, v] of optimisticRef.current.entries()) {
        if (v.expires <= currentTime) optimisticRef.current.delete(k);
      }

      // Only update if there are actual changes
      const currentPendingCount = withOptimistic.filter((req: DeliveryRequest) => 
        req.status === 'pending' || req.status === 'pending_confirmation'
      ).length;
      
      if (currentPendingCount !== previousRequestCount) {
        setPreviousRequestCount(currentPendingCount);
        console.log(`📊 Request count updated: ${currentPendingCount} pending requests`);
      }

      setDeliveryRequests(withOptimistic);
      setIsLoading(false);
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return; // Ignore aborted fetch errors silently
      }
      console.error('Error fetching delivery requests:', err);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Unable to fetch delivery requests. Check if backend is running.",
      });
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [toast, previousRequestCount]);

  useEffect(() => {
    // Initial fetch
    setIsLoading(true);
    fetchDeliveryRequests();

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

    // Optimized polling: reduced frequency and smart updates
    const interval = setInterval(() => {
      // Only poll if there are pending requests or if it's been more than 10 seconds
      const hasPendingRequests = deliveryRequests.some(req => 
        req.status === 'pending' || req.status === 'pending_confirmation'
      );
      
      if (hasPendingRequests || Date.now() - lastUpdateRef.current > 10000) {
        fetchDeliveryRequests();
      }
    }, 5000); // Increased from 3 to 5 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchDeliveryRequests]);

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

      // Optimistic update: update local state immediately
      const optimisticKey = String(currentRequest._id || currentRequest.requestId || '');
      optimisticRef.current.set(optimisticKey, { 
        status: newStatus as DeliveryRequest['status'], 
        expires: Date.now() + 8000 
      });
      
      // Update local state immediately
      setDeliveryRequests(prev => prev.map(req =>
        (req._id || req.requestId) === requestId ? { ...req, status: newStatus as DeliveryRequest['status'] } : req
      ));

      // Record the update time to prevent immediate refetch
      lastUpdateRef.current = Date.now();

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
                  Make sure the backend is running on port 4000. 
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
        <div className="px-2 py-1">
          <div className="flex items-center justify-between">
            <StaffDashboardMetrics 
              requests={deliveryRequests} 
              requestCounts={requestCounts}
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
            requests={sortedRequests} 
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


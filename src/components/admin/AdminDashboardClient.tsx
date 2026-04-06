"use client";

/**
 * Admin Dashboard Client Component
 * 
 * PHASE 2: This component handles all client-side interactivity:
 * - Authentication check (localStorage)
 * - Polling/WebSocket updates
 * - User interactions
 * - State management
 * 
 * Initial data is passed from server component to avoid client-side fetch delay
 */

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Customer, DeliveryRequest } from '@/types';
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerForm from '@/components/forms/CustomerForm';
import CreateDeliveryRequestForm from '@/components/forms/CreateDeliveryRequestForm';
import CustomerList, { CustomerListRef } from '@/components/admin/CustomerList';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import { createDashboardDataHash, createDeliveryRequestsHash } from '@/lib/data-utils'; // PHASE 5: Use shared hash utilities
import { requestDeduplicator } from '@/lib/api-cache'; // PHASE 5: Request deduplication
import TabNavigation from '@/components/admin/TabNavigation';
import DeliveryTab from '@/components/admin/tabs/DeliveryTab';
import RecurringTab from '@/components/admin/tabs/RecurringTab';
import StatsTab from '@/components/admin/tabs/StatsTab';
import CustomersTab from '@/components/admin/tabs/CustomersTab';

interface AdminDashboardClientProps {
  initialMetrics: any | null;
  initialRequests: DeliveryRequest[];
}

export default function AdminDashboardClient({
  initialMetrics,
  initialRequests
}: AdminDashboardClientProps) {
  const router = useRouter();
  
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  const [isCustomerFormDialogOpen, setIsCustomerFormDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null); 

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [editingRequestData, setEditingRequestData] = useState<DeliveryRequest | null>(null);
  const [customerToPreselectForRequest, setCustomerToPreselectForRequest] = useState<Customer | null>(null);

  // Initialize state with server data (PHASE 2: Server-side data)
  const [totalCustomers, setTotalCustomers] = useState(initialMetrics?.totalCustomers || 0);
  const [pendingDeliveries, setPendingDeliveries] = useState(initialMetrics?.pendingRequests || 0);
  const [deliveriesTodayCount, setDeliveriesTodayCount] = useState(initialMetrics?.deliveries || 0);
  const [totalCansToday, setTotalCansToday] = useState(initialMetrics?.totalCans || 0);
  const [totalAmountGenerated, setTotalAmountGenerated] = useState(initialMetrics?.totalAmountGenerated || 0);
  const [totalCashAmountGenerated, setTotalCashAmountGenerated] = useState(initialMetrics?.totalCashAmountGenerated || 0);
  const [currentTimeLabel, setCurrentTimeLabel] = useState(initialMetrics?.timeLabel || 'Today');
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>(initialRequests || []);

  // Silent refresh system - prevents visual page reloads
  const silentRefreshRef = useRef<boolean>(false);
  const lastDataHashRef = useRef<string>('');
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const requestsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store the functions in refs to avoid dependency issues
  const fetchDashboardMetricsRef = useRef<typeof fetchDashboardMetrics>();
  const refreshDeliveryRequestsRef = useRef<typeof refreshDeliveryRequests>();

  // Tab navigation state
  const [activeTab, setActiveTab] = useState('delivery');

  const customerListRef = useRef<CustomerListRef>(null);

  // PHASE 5: Use shared hash utilities
  // Removed duplicate hash functions - now using shared utilities from @/lib/data-utils

  useEffect(() => {
    // Check for valid admin authentication session
    const checkAuth = () => {
      try {
        const authSession = localStorage.getItem('paani_auth_session');
        if (authSession) {
          const session = JSON.parse(authSession);
          
          // Verify it's an admin session
          if (session.userType === 'admin' && session.email === 'admin@paani.com') {
            setAuthUser({
              uid: session.sessionId,
              email: session.email,
              userType: session.userType,
              loginTime: session.loginTime
            });
            console.log('✅ Admin authentication verified');
          } else {
            // Invalid session, redirect to login
            console.log('❌ Invalid admin session, redirecting to login');
            router.push('/admin/login');
          }
        } else {
          // No session, redirect to login
          console.log('❌ No admin session found, redirecting to login');
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Ensure activeTab is always valid
  useEffect(() => {
    const validTabs = ['delivery', 'recurring', 'stats', 'customers'];
    if (!validTabs.includes(activeTab)) {
      setActiveTab('delivery');
    }
  }, [activeTab]);

  const refreshDeliveryRequests = useCallback(async (isSilentRefresh: boolean = false) => {
    // PHASE 5: Use request deduplication to prevent duplicate API calls
    return requestDeduplicator.fetch('delivery-requests', async () => {
      try {
        // PHASE 4: Use pagination to limit data transfer (100 records max)
        const res = await fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=100`));
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const result = await res.json();
      // PHASE 4: Handle paginated response - extract data array if paginated
      const data = Array.isArray(result) ? result : (result?.data || []);
      
      // Create hash of new data to detect real changes
      const newDataHash = createDeliveryRequestsHash(data || []);
      const hasRealChanges = newDataHash !== lastDataHashRef.current;
      
      // Only update state if there are real changes or it's not a silent refresh
      if (hasRealChanges || !isSilentRefresh) {
        // Update the hash reference
        lastDataHashRef.current = newDataHash;
        
        // Update delivery requests with smooth transition
        setDeliveryRequests(data || []);
        
        if (isSilentRefresh && hasRealChanges) {
          console.log('🔄 Admin dashboard: Delivery requests updated silently');
        }
      }
    } catch (err) {
      console.error('Error fetching delivery requests:', err);
      if (!isSilentRefresh) {
        setDeliveryRequests([]);
      }
    }
    });
  }, [createDeliveryRequestsHash]);

  const fetchDashboardMetrics = useCallback(async (isSilentRefresh: boolean = false) => {
    // PHASE 5: Use request deduplication to prevent duplicate API calls
    return requestDeduplicator.fetch('dashboard-metrics', async () => {
      try {
        if (!isSilentRefresh) {
          setIsLoading(true);
        }
        
        const res = await fetch(buildApiUrl(API_ENDPOINTS.DASHBOARD_METRICS));
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        
        // Create hash of new data to detect real changes
        const newDataHash = createDashboardDataHash(data);
        const hasRealChanges = newDataHash !== lastDataHashRef.current;
        
        // Only update state if there are real changes or it's not a silent refresh
        if (hasRealChanges || !isSilentRefresh) {
          // Update the hash reference
          lastDataHashRef.current = newDataHash;
          
          // Update metrics with smooth transition
          setTotalCustomers(data.totalCustomers || 0);
          setPendingDeliveries(data.pendingRequests || 0);
          setDeliveriesTodayCount(data.deliveries || 0);
          setTotalCansToday(data.totalCans || 0);
          setTotalAmountGenerated(data.totalAmountGenerated || 0);
          setTotalCashAmountGenerated(data.totalCashAmountGenerated || 0);
          setCurrentTimeLabel(data.timeLabel || 'Today');
          
          if (isSilentRefresh && hasRealChanges) {
            console.log('🔄 Admin dashboard: Metrics updated silently');
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        if (!isSilentRefresh) {
          setTotalCustomers(0);
          setPendingDeliveries(0);
          setDeliveriesTodayCount(0);
          setTotalCansToday(0);
          setTotalAmountGenerated(0);
          setTotalCashAmountGenerated(0);
        }
      } finally {
        if (!isSilentRefresh) {
          setIsLoading(false);
        }
      }
    });
  }, [createDashboardDataHash]);

  // PHASE 3: WebSocket connections for real-time updates
  // Replace polling with WebSocket for instant updates
  const { isConnected: metricsConnected, lastMessage: metricsUpdate } = useWebSocket(
    'dashboardMetrics',
    useCallback((data) => {
      if (data?.type === 'refresh' && fetchDashboardMetricsRef.current) {
        console.log('📡 WebSocket: Refreshing metrics');
        fetchDashboardMetricsRef.current(true);
      }
    }, [])
  );

  const { isConnected: requestsConnected, lastMessage: requestsUpdate } = useWebSocket(
    'deliveryRequests',
    useCallback((data) => {
      if (data?.type === 'created') {
        console.log('📡 WebSocket: New delivery request created');
        setDeliveryRequests(prev => {
          // Check if request already exists (avoid duplicates)
          const exists = prev.some(req => 
            (req._id || req.requestId) === (data.data._id || data.data.requestId)
          );
          if (exists) return prev;
          return [data.data, ...prev];
        });
        // Also refresh metrics
        if (fetchDashboardMetricsRef.current) {
          fetchDashboardMetricsRef.current(true);
        }
      } else if (data?.type === 'updated') {
        console.log('📡 WebSocket: Delivery request updated');
        setDeliveryRequests(prev => prev.map(req => 
          (req._id || req.requestId) === (data.data._id || data.data.requestId) 
            ? { ...req, ...data.data } 
            : req
        ));
        // Also refresh metrics
        if (fetchDashboardMetricsRef.current) {
          fetchDashboardMetricsRef.current(true);
        }
      }
    }, [])
  );

  // Store the functions in refs after they're defined
  const [functionsReady, setFunctionsReady] = useState(false);
  
  useEffect(() => {
    try {
      console.log('🔄 Admin dashboard: Storing functions in refs...');
      fetchDashboardMetricsRef.current = fetchDashboardMetrics;
      refreshDeliveryRequestsRef.current = refreshDeliveryRequests;
      setFunctionsReady(true);
      console.log('✅ Admin dashboard: Functions stored in refs successfully');
    } catch (error) {
      console.error('❌ Admin dashboard: Error storing functions in refs:', error);
    }
  }, [fetchDashboardMetrics, refreshDeliveryRequests]);

  // PHASE 3: Fallback polling setup (only if WebSocket is not connected)
  // WebSocket is primary, polling is fallback for reliability
  useEffect(() => {
    if (!authUser) {
      setTotalCustomers(0);
      setPendingDeliveries(0);
      setDeliveriesTodayCount(0);
      setTotalCansToday(0);
      setTotalAmountGenerated(0);
      setTotalCashAmountGenerated(0);
      setDeliveryRequests([]);
      return;
    }

    // Wait for functions to be available in refs
    if (!fetchDashboardMetricsRef.current || !refreshDeliveryRequestsRef.current) {
      return;
    }
    
    // PHASE 3: Use WebSocket as primary, polling as fallback
    // If WebSocket is connected, use longer polling interval (30s) as backup
    // If WebSocket is not connected, use shorter interval (5s) for reliability
    const pollingInterval = (metricsConnected && requestsConnected) ? 30000 : 5000;
    
    console.log(`🔄 Admin dashboard: ${(metricsConnected && requestsConnected) ? 'WebSocket active' : 'Polling fallback'} - interval: ${pollingInterval}ms`);
    
    // Initial refresh
    Promise.all([
      fetchDashboardMetricsRef.current(true),
      refreshDeliveryRequestsRef.current(true)
    ]).catch(() => {});

    // Fallback polling (longer interval when WebSocket is active)
    metricsIntervalRef.current = setInterval(() => {
      if (fetchDashboardMetricsRef.current) {
        fetchDashboardMetricsRef.current(true);
      }
    }, pollingInterval);

    requestsIntervalRef.current = setInterval(() => {
      if (refreshDeliveryRequestsRef.current) {
        refreshDeliveryRequestsRef.current(true);
      }
    }, pollingInterval);

    // Cleanup intervals on unmount
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
      if (requestsIntervalRef.current) {
        clearInterval(requestsIntervalRef.current);
        requestsIntervalRef.current = null;
      }
    };
  }, [authUser, functionsReady, metricsConnected, requestsConnected]);

  // Pause/resume silent refreshes when page is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (metricsIntervalRef.current) {
          clearInterval(metricsIntervalRef.current);
          metricsIntervalRef.current = null;
          console.log('🔄 Admin dashboard: Silent refreshes paused (page hidden)');
        }
        if (requestsIntervalRef.current) {
          clearInterval(requestsIntervalRef.current);
          requestsIntervalRef.current = null;
        }
      } else {
        if (!metricsIntervalRef.current && fetchDashboardMetricsRef.current) {
          metricsIntervalRef.current = setInterval(() => {
            if (fetchDashboardMetricsRef.current) {
              fetchDashboardMetricsRef.current(true);
            }
          }, 3000);
        }
        if (!requestsIntervalRef.current && refreshDeliveryRequestsRef.current) {
          requestsIntervalRef.current = setInterval(() => {
            if (refreshDeliveryRequestsRef.current) {
              refreshDeliveryRequestsRef.current(true);
            }
          }, 3000);
        }
        console.log('🔄 Admin dashboard: Silent refreshes resumed (page visible)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Check backend connection
    const checkBackendConnection = async () => {
      try {
        const healthUrl = buildApiUrl(API_ENDPOINTS.HEALTH);
        
        // Create AbortController for timeout (fallback if AbortSignal.timeout is not supported)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setIsBackendConnected(response.ok);
        
        if (!response.ok) {
          console.warn('⚠️ Backend health check failed:', response.status);
        }
      } catch (err: any) {
        // Silently handle connection errors (backend might not be running)
        if (err.name === 'AbortError' || err.message?.includes('fetch')) {
          // Backend is not available - this is expected in development
          setIsBackendConnected(false);
        } else {
          console.warn('⚠️ Backend connection check failed:', err.message || err);
          setIsBackendConnected(false);
        }
      }
    };

    checkBackendConnection();
    const interval = setInterval(checkBackendConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('paani_auth_session');
      localStorage.removeItem('admin_staff_access');
      console.log('✅ Admin signed out successfully');
      router.push('/admin/login');
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out. Please try again.');
    }
  };

  const openRequestDialog = (requestToEdit?: DeliveryRequest, customerToPreselect?: Customer) => {
    if (requestToEdit) {
        setEditingRequestData(requestToEdit);
        setCustomerToPreselectForRequest(null); 
    } else if (customerToPreselect) {
        setCustomerToPreselectForRequest(customerToPreselect);
        setEditingRequestData(null); 
    } else { 
        setEditingRequestData(null);
        setCustomerToPreselectForRequest(null);
    }
    setIsRequestDialogOpen(true);
  };

  const closeRequestDialog = () => {
    setIsRequestDialogOpen(false);
    setEditingRequestData(null);
    setCustomerToPreselectForRequest(null);
  };

  const handleEditCustomer = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsCustomerFormDialogOpen(true);
  };

  const handleAddNewCustomer = () => {
    setCustomerToEdit(null);
    setIsCustomerFormDialogOpen(true);
  }

  const handleInitiateNewRequest = (customer?: Customer) => {
    openRequestDialog(undefined, customer);
  };

  const handleEditRequest = (request: DeliveryRequest) => {
    openRequestDialog(request);
  };

  const triggerSilentRefresh = useCallback(() => {
    if (fetchDashboardMetricsRef.current) {
      fetchDashboardMetricsRef.current(true);
    }
    if (refreshDeliveryRequestsRef.current) {
      refreshDeliveryRequestsRef.current(true);
    }
  }, []);

  const handleCustomerFormSuccess = () => {
    setIsCustomerFormDialogOpen(false);
    if (customerListRef.current) {
      customerListRef.current.refreshCustomers();
    }
    if (functionsReady) {
      triggerSilentRefresh();
    }
  };

  if (isLoading) { 
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/10">
        <Card className="w-full max-w-md text-center glass-card">
          <CardHeader><CardTitle>Loading Dashboard...</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto bg-muted/50" />
            <Skeleton className="h-12 w-full bg-muted/50" /><Skeleton className="h-12 w-full bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!authUser) {
    return (
       <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/10">
         <Card className="w-full max-w-xs text-center glass-card p-6">
           <CardHeader><CardTitle>Loading...</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-8 w-3/4 mx-auto bg-muted/50" />
            </CardContent>
         </Card>
       </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/5">
      
      <main className="flex-grow flex flex-col">
        {/* Backend connection banner removed */}
        
        {/* WebSocket status message hidden */}
        
        {/* PHASE 2: Streaming SSR with Suspense - sections load progressively */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} onSignOut={handleSignOut}>
          <Suspense fallback={
            <div className="p-4">
              <Skeleton className="h-8 w-48 mb-4 bg-muted/50" />
              <Skeleton className="h-64 w-full bg-muted/50" />
            </div>
          }>
            <DeliveryTab 
              deliveryRequests={deliveryRequests}
              setDeliveryRequests={setDeliveryRequests}
              onInitiateNewRequest={handleInitiateNewRequest}
              onEditRequest={handleEditRequest}
            />
          </Suspense>
          
          <Suspense fallback={
            <div className="p-4">
              <Skeleton className="h-8 w-48 mb-4 bg-muted/50" />
              <Skeleton className="h-64 w-full bg-muted/50" />
            </div>
          }>
            <RecurringTab />
          </Suspense>
          
          <Suspense fallback={
            <div className="p-4">
              <Skeleton className="h-8 w-48 mb-4 bg-muted/50" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full bg-muted/50" />
                ))}
              </div>
            </div>
          }>
            <StatsTab 
              totalCustomers={totalCustomers}
              pendingDeliveries={pendingDeliveries}
              deliveriesTodayCount={deliveriesTodayCount}
              totalCansToday={totalCansToday}
              totalAmountGenerated={totalAmountGenerated}
              totalCashAmountGenerated={totalCashAmountGenerated}
              currentTimeLabel={currentTimeLabel}
            />
          </Suspense>
          
          <Suspense fallback={
            <div className="p-4">
              <Skeleton className="h-8 w-48 mb-4 bg-muted/50" />
              <Skeleton className="h-64 w-full bg-muted/50" />
            </div>
          }>
            <CustomersTab 
              customerListRef={customerListRef}
              onEditCustomer={handleEditCustomer}
              onAddNewCustomer={handleAddNewCustomer}
            />
          </Suspense>
        </TabNavigation>

        <Dialog open={isCustomerFormDialogOpen} onOpenChange={setIsCustomerFormDialogOpen}>
          <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[calc(100vh-4rem)] glass-card">
            <DialogHeader>
              <DialogTitle>{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2 py-4">
              <CustomerForm 
                editingCustomer={customerToEdit}
                onSuccess={handleCustomerFormSuccess} 
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isRequestDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) closeRequestDialog(); else setIsRequestDialogOpen(true);
        }}>
          <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[calc(100vh-4rem)] glass-card">
            <DialogHeader>
              <DialogTitle>{editingRequestData ? 'Edit Delivery Request' : 'Create Delivery Request'}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2 py-2">
              <CreateDeliveryRequestForm 
                onSuccess={() => { 
                  if (refreshDeliveryRequestsRef.current) {
                    refreshDeliveryRequestsRef.current(false);
                  }
                  if (functionsReady) {
                    triggerSilentRefresh();
                  }
                  closeRequestDialog(); 
                }}
                onCloseDialog={closeRequestDialog} 
                customerToPreselect={customerToPreselectForRequest}
                editingRequest={editingRequestData}
              />
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}


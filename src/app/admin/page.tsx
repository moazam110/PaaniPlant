
"use client";

/**
 * Admin Dashboard with Silent Background Updates
 * 
 * This component implements a silent refresh system that updates data in the background
 * every 3 minutes without causing visual page reloads or disrupting the user experience.
 * 
 * Key Features:
 * - Silent background data updates every 3 minutes
 * - Smart change detection to prevent unnecessary re-renders
 * - Smooth data transitions
 * - Resource optimization when page is not visible
 * - Visual indicators for live updates without disruption
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Customer, DeliveryRequest } from '@/types';
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CustomerForm from '@/components/forms/CustomerForm';
import CreateDeliveryRequestForm from '@/components/forms/CreateDeliveryRequestForm';
import CustomerList, { CustomerListRef } from '@/components/admin/CustomerList';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import TabNavigation from '@/components/admin/TabNavigation';
import DeliveryTab from '@/components/admin/tabs/DeliveryTab';
import RecurringTab from '@/components/admin/tabs/RecurringTab';
import StatsTab from '@/components/admin/tabs/StatsTab';
import CustomersTab from '@/components/admin/tabs/CustomersTab';

export default function AdminDashboardPage() {
  const router = useRouter();
  
  const [authUser, setAuthUser] = useState<any | null>(null); // Placeholder for auth user
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  const [isCustomerFormDialogOpen, setIsCustomerFormDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null); 

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [editingRequestData, setEditingRequestData] = useState<DeliveryRequest | null>(null);
  const [customerToPreselectForRequest, setCustomerToPreselectForRequest] = useState<Customer | null>(null);

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [deliveriesTodayCount, setDeliveriesTodayCount] = useState(0);
  const [totalCansToday, setTotalCansToday] = useState(0);
  const [totalAmountGenerated, setTotalAmountGenerated] = useState(0);
  const [totalCashAmountGenerated, setTotalCashAmountGenerated] = useState(0);
  const [currentTimeLabel, setCurrentTimeLabel] = useState('Today');
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);

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

  // Utility function to create a hash of dashboard data for change detection
  const createDashboardDataHash = useCallback((data: any): string => {
    try {
      return `${data?.totalCustomers || 0}-${data?.pendingRequests || 0}-${data?.deliveries || 0}-${data?.totalCans || 0}-${data?.totalAmountGenerated || 0}-${data?.totalCashAmountGenerated || 0}`;
    } catch (error) {
      console.error('Error creating dashboard data hash:', error);
      return 'error-hash';
    }
  }, []);

  // Utility function to create a hash of delivery requests for change detection
  const createDeliveryRequestsHash = useCallback((requests: DeliveryRequest[]): string => {
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
  }, []);

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
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS));
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      
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
  }, [createDeliveryRequestsHash]);

  const fetchDashboardMetrics = async (isSilentRefresh: boolean = false) => {
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
  };

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

  // Stable polling setup - only runs once on mount
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

    // Prevent multiple setups
    if (metricsIntervalRef.current || requestsIntervalRef.current) {
      console.log('🔄 Admin dashboard: Polling already set up, skipping duplicate setup');
      return;
    }
    
    console.log('🔄 Admin dashboard: Initializing polling system');
    
    // Wait for functions to be available in refs
    if (!fetchDashboardMetricsRef.current || !refreshDeliveryRequestsRef.current) {
      console.log('🔄 Admin dashboard: Functions not ready yet, waiting...', {
        metricsReady: !!fetchDashboardMetricsRef.current,
        requestsReady: !!refreshDeliveryRequestsRef.current,
        functionsReady
      });
      return;
    }
    
    // Initial fetch (non-silent)
    fetchDashboardMetricsRef.current(false);
    refreshDeliveryRequestsRef.current(false);

    // Enhanced silent polling: every 3 seconds with silent background updates
    // These intervals are set up once and never change
    metricsIntervalRef.current = setInterval(() => {
      if (fetchDashboardMetricsRef.current) {
        console.log('🔄 Admin dashboard: Silent metrics refresh triggered');
        fetchDashboardMetricsRef.current(true);
      }
    }, 3000); // 3 seconds

    requestsIntervalRef.current = setInterval(() => {
      if (refreshDeliveryRequestsRef.current) {
        console.log('🔄 Admin dashboard: Silent delivery requests refresh triggered');
        refreshDeliveryRequestsRef.current(true);
      }
    }, 3000); // 3 seconds

    // Cleanup intervals on unmount
    return () => {
      console.log('🔄 Admin dashboard: Cleaning up polling system');
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
      if (requestsIntervalRef.current) {
        clearInterval(requestsIntervalRef.current);
        requestsIntervalRef.current = null;
      }
    };
  }, [authUser, functionsReady]); // Re-run when functions become available

  // Pause/resume silent refreshes when page is not visible (save resources)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause silent refreshes
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
        // Page is visible, resume silent refreshes
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
  }, []); // Empty dependency array - only runs once

  useEffect(() => {
    // Check backend connection
    const checkBackendConnection = async () => {
      try {
        const healthUrl = buildApiUrl(API_ENDPOINTS.HEALTH);
        console.log('🔍 Health check URL:', healthUrl);
        console.log('🌐 API_BASE_URL:', API_BASE_URL);
        console.log('🔧 Environment NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          // Add a timeout to prevent hanging
          signal: AbortSignal.timeout(5000)
        });
        
        console.log('✅ Health check response status:', response.status);
        console.log('📦 Health check response ok:', response.ok);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Health check data:', data);
        }
        
        setIsBackendConnected(response.ok);
        
        if (!response.ok) {
          console.warn('⚠️ Backend health check failed:', response.status);
        }
      } catch (err) {
        console.error('❌ Backend connection error:', err);
        setIsBackendConnected(false);
      }
    };

    checkBackendConnection();
    // Check connection every 10 seconds instead of 30 for faster detection
    const interval = setInterval(checkBackendConnection, 10000);
    return () => clearInterval(interval);
  }, []);


  const handleSignOut = async () => {
    try {
      // Clear the authentication session
      localStorage.removeItem('paani_auth_session');
      
      // Also clear admin staff access when admin logs out completely
      localStorage.removeItem('admin_staff_access');
      
      console.log('✅ Admin signed out successfully');
      
      // Redirect to login page
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

  // Function to manually trigger silent refreshes (useful for external updates)
  const triggerSilentRefresh = useCallback(() => {
    if (fetchDashboardMetricsRef.current) {
      fetchDashboardMetricsRef.current(true);
    }
    if (refreshDeliveryRequestsRef.current) {
      refreshDeliveryRequestsRef.current(true);
    }
  }, []); // No dependencies needed since we use refs

  const handleCustomerFormSuccess = () => {
    setIsCustomerFormDialogOpen(false);
    // Refresh the customer list after successful add/edit
    if (customerListRef.current) {
      customerListRef.current.refreshCustomers();
    }
    // Only trigger silent refresh if functions are ready
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
        
                 {/* Subtle background update indicator */}
         {isBackendConnected && (
           <div className="mx-4 mt-2 flex items-center justify-center">
             <div className="flex items-center gap-2 text-xs text-muted-foreground">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               <span>Live updates enabled • Data refreshes every 3 seconds</span>
             </div>
           </div>
         )}
        
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab}>
          <DeliveryTab 
            deliveryRequests={deliveryRequests}
            setDeliveryRequests={setDeliveryRequests}
            onInitiateNewRequest={handleInitiateNewRequest}
            onEditRequest={handleEditRequest}
          />
          <RecurringTab />
          
          <StatsTab 
            totalCustomers={totalCustomers}
            pendingDeliveries={pendingDeliveries}
            deliveriesTodayCount={deliveriesTodayCount}
            totalCansToday={totalCansToday}
            totalAmountGenerated={totalAmountGenerated}
            totalCashAmountGenerated={totalCashAmountGenerated}
            currentTimeLabel={currentTimeLabel}
          />
          
          <CustomersTab 
            customerListRef={customerListRef}
            onEditCustomer={handleEditCustomer}
            onAddNewCustomer={handleAddNewCustomer}
          />
        </TabNavigation>

            {/* Dialog for Adding/Editing Customer */}
            <Dialog open={isCustomerFormDialogOpen} onOpenChange={setIsCustomerFormDialogOpen}>
                <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[calc(100vh-4rem)] glass-card">
                    <div className="flex-grow overflow-y-auto pr-2 py-4">
                        <CustomerForm 
                            editingCustomer={customerToEdit}
                            onSuccess={handleCustomerFormSuccess} 
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog for Creating/Editing Delivery Request */}
            <Dialog open={isRequestDialogOpen} onOpenChange={(isOpen) => {
                if (!isOpen) closeRequestDialog(); else setIsRequestDialogOpen(true);
            }}>
                <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[calc(100vh-4rem)] glass-card">
                    <div className="flex-grow overflow-y-auto pr-2 py-2">
                        <CreateDeliveryRequestForm 
                            onSuccess={() => { 
                              if (refreshDeliveryRequestsRef.current) {
                                refreshDeliveryRequestsRef.current(false); // Non-silent refresh for immediate feedback
                              }
                              // Only trigger silent refresh if functions are ready
                              if (functionsReady) {
                                triggerSilentRefresh(); // Also refresh metrics
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
        
        {/* Bottom Sign Out Button */}
        <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30 flex justify-center">
          <Button 
            variant="outline" 
            onClick={handleSignOut} 
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
    </div>
  );
}
    

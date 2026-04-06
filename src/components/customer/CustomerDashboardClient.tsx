"use client";

/**
 * Customer Dashboard Client Component
 * 
 * Phase 1: Basic functionality without authentication
 * - Shows customer's own requests
 * - Create request button
 * - Date range filter (From/To Date only)
 * - Vibrant, crystal-style design
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Footer from '@/components/shared/Footer';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import type { DeliveryRequest, Customer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, LogOut, Filter, Receipt, Menu, Phone, MapPin, MessageCircle, Bell } from 'lucide-react';

interface PriceNotification {
  _id: string;
  data: { oldPrice: number; newPrice: number };
  isRead: boolean;
  createdAt: string;
}
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import CustomerRequestForm from './CustomerRequestForm';
import CustomerRequestHistory from './CustomerRequestHistory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { useWebSocket } from '@/hooks/use-websocket';

interface CustomerDashboardClientProps {
  initialRequests: DeliveryRequest[];
}

export default function CustomerDashboardClient({
  initialRequests
}: CustomerDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  // Phase 4: Get customer from authenticated session
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>(initialRequests || []);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ from?: Date; to?: Date }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);
  const [billMonth, setBillMonth] = useState<number>(new Date().getMonth() + 1);
  const [billYear, setBillYear] = useState<number>(new Date().getFullYear());
  const [menuOpen, setMenuOpen] = useState(false);

  // Price change notifications state
  const [priceNotifications, setPriceNotifications] = useState<PriceNotification[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifBellOpen, setNotifBellOpen] = useState(false);

  // Fetch fresh delivery requests on mount to ensure correct status (bypass cache)
  useEffect(() => {
    const fetchFreshRequests = async () => {
      try {
        // Add timestamp to ensure fresh data
        const timestamp = Date.now();
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=1000&_t=${timestamp}`), {
          cache: 'no-store', // Always fetch fresh data
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        if (response.ok) {
          const result = await response.json();
          const requests = Array.isArray(result) ? result : (result?.data || []);
          setDeliveryRequests(requests);
          console.log('✅ Customer dashboard: Loaded fresh delivery requests on mount', requests.length, 'requests');
        } else {
          console.error('Failed to fetch fresh requests:', response.status);
          // Fallback to initialRequests if fetch fails
          if (initialRequests && initialRequests.length > 0) {
            setDeliveryRequests(initialRequests);
            console.log('⚠️ Using initialRequests as fallback');
          }
        }
      } catch (error) {
        console.error('Error fetching fresh delivery requests:', error);
        // Fallback to initialRequests if fetch fails
        if (initialRequests && initialRequests.length > 0) {
          setDeliveryRequests(initialRequests);
          console.log('⚠️ Using initialRequests as fallback due to error');
        }
      }
    };
    
    fetchFreshRequests();
  }, []);

  // Check authentication and get customer data
  useEffect(() => {
    const session = localStorage.getItem('customer_session');
    
    if (!session) {
      router.push('/customer/login');
      return;
    }

    try {
      const sessionData = JSON.parse(session);
      const id = sessionData.customerId;
      const customerData = sessionData.customer;

      if (id && customerData) {
        setCustomerId(String(id));
        setCustomer(customerData as Customer);
        setIsAuthenticated(true);
        setIsLoading(false);
      } else if (id) {
        // If we have ID but not customer data, fetch it
        setCustomerId(String(id));
        fetchCustomerData(String(id));
      } else {
        router.push('/customer/login');
      }
    } catch (e) {
      console.error('Error parsing customer session:', e);
      router.push('/customer/login');
    }
  }, [router]);

  // Periodically validate customer access (check every 30 seconds)
  useEffect(() => {
    if (!customerId) return;

    const validateAccess = async () => {
      try {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMER_CREDENTIALS}/${customerId}`));
        if (response.ok) {
          const credential = await response.json();
          // Check if dashboard access has been revoked
          if (!credential.hasDashboardAccess) {
            toast({
              variant: "destructive",
              title: "Access Revoked",
              description: "Your dashboard access has been revoked. Redirecting to login...",
            });
            localStorage.removeItem('customer_session');
            setTimeout(() => {
              router.push('/customer/login');
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Error validating customer access:', error);
      }
    };

    // Validate immediately and then every 30 seconds
    validateAccess();
    const interval = setInterval(validateAccess, 30000);

    return () => clearInterval(interval);
  }, [customerId, router, toast]);

  const fetchCustomerData = async (id: string) => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=1000`));
      if (response.ok) {
        const result = await response.json();
        const customers = Array.isArray(result) ? result : (result?.data || []);
        const foundCustomer = customers.find((c: Customer) => {
          const raw = (c as any)._id || (c as any).customerId;
          const normalized = raw && typeof raw === 'object'
            ? String(raw._id ?? raw.id ?? '')
            : String(raw ?? '');
          return normalized === id || (c as any).id?.toString() === id;
        });
        
        if (foundCustomer) {
          setCustomer(foundCustomer);
          setIsAuthenticated(true);
        } else {
          toast({
            variant: "destructive",
            title: "Customer Not Found",
            description: "Unable to find customer information. Please contact admin.",
          });
          router.push('/customer/login');
        }
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customer information.",
      });
      router.push('/customer/login');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter requests by customer ID and date range
  const filteredRequests = useMemo(() => {
    if (!customerId) return [];
    
    let filtered = deliveryRequests.filter(req => {
      const raw = (req as any).customerId;
      const normalized = raw && typeof raw === 'object'
        ? String(raw._id ?? raw.id ?? '')
        : String(raw ?? '');
      return normalized === customerId || (req as any).customerIntId?.toString() === customerId;
    });

    // Apply date filter
    if (dateFilter.from || dateFilter.to) {
      filtered = filtered.filter(req => {
        if (!req.requestedAt) return false;
        const requestDate = new Date(req.requestedAt);
        requestDate.setHours(0, 0, 0, 0);
        
        if (dateFilter.from) {
          const fromDate = new Date(dateFilter.from);
          fromDate.setHours(0, 0, 0, 0);
          if (requestDate < fromDate) return false;
        }
        
        if (dateFilter.to) {
          const toDate = new Date(dateFilter.to);
          toDate.setHours(23, 59, 59, 999);
          if (requestDate > toDate) return false;
        }
        
        return true;
      });
    }

    // Sort by requestedAt (newest first)
    return filtered.sort((a, b) => {
      const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [deliveryRequests, customerId, dateFilter]);

  // Fetch billing stats from backend API (same as CustomerList/CustomerForm)
  const [billingStats, setBillingStats] = useState({ totalDeliveries: 0, totalCans: 0, pricePerCan: 0, totalBill: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (!customerId || !isBillDialogOpen) return;

    const fetchCustomerStats = async () => {
      setIsLoadingStats(true);
      try {
        // Use the same endpoint as CustomerForm.tsx for consistency
        const statsUrl = buildApiUrl(`api/customers/${customerId}/stats?month=${billMonth}&year=${billYear}`);
        console.log('Fetching customer stats from:', statsUrl);
        
        const response = await fetch(statsUrl);
        
        if (response.ok) {
          const stats = await response.json();
          console.log('Customer stats received:', stats);
          setBillingStats({
            totalDeliveries: stats.totalDeliveries || 0,
            totalCans: stats.totalCansReceived || 0,
            pricePerCan: stats.pricePerCan || customer?.pricePerCan || 0,
            totalBill: stats.totalPrice || 0,
          });
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch customer stats:', response.status, errorText);
          setBillingStats({ totalDeliveries: 0, totalCans: 0, pricePerCan: customer?.pricePerCan || 0, totalBill: 0 });
        }
      } catch (error) {
        console.error("Error fetching customer stats:", error);
        setBillingStats({ totalDeliveries: 0, totalCans: 0, pricePerCan: customer?.pricePerCan || 0, totalBill: 0 });
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    fetchCustomerStats();
  }, [customerId, billMonth, billYear, isBillDialogOpen, customer]);

  // Fetch price change notifications for this customer
  const fetchPriceNotifications = useCallback(async (id: string) => {
    try {
      const res = await fetch(buildApiUrl(`api/notifications/customer/${id}`));
      if (res.ok) {
        const data = await res.json();
        setPriceNotifications(data.notifications || []);
        setNotifUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // non-critical
    }
  }, []);

  // Load notifications once customerId is known
  useEffect(() => {
    if (customerId) {
      fetchPriceNotifications(customerId);
    }
  }, [customerId, fetchPriceNotifications]);

  // Handle bell open: fetch fresh notifications and mark as read
  const handleNotifBellOpen = async (open: boolean) => {
    setNotifBellOpen(open);
    if (open && customerId) {
      await fetchPriceNotifications(customerId);
      if (notifUnreadCount > 0) {
        try {
          await fetch(buildApiUrl(`api/notifications/customer/${customerId}/read-all`), { method: 'PUT' });
          setNotifUnreadCount(0);
          setPriceNotifications((prev: PriceNotification[]) => prev.map((n: PriceNotification) => ({ ...n, isRead: true })));
        } catch { /* non-critical */ }
      }
    }
  };

  // Real-time updates via WebSocket - sync with admin dashboard
  useWebSocket(
    'deliveryRequests',
    (data: any) => {
      if (data?.type === 'created' || data?.type === 'updated' || data?.type === 'deleted') {
        // Refresh requests when new ones are created, updated, or deleted
        // This ensures parallel sync with admin dashboard
        // Add timestamp to bypass cache
        const timestamp = Date.now();
        fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=1000&_t=${timestamp}`), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        })
          .then(res => res.json())
          .then(result => {
            const requests = Array.isArray(result) ? result : (result?.data || []);
            setDeliveryRequests(requests);
            console.log('🔄 Customer dashboard: Delivery requests refreshed via WebSocket', requests.length);
          })
          .catch(err => console.error('Error refreshing requests:', err));
      }
    }
  );

  // Listen for logout events (password changed or access revoked)
  useWebSocket(
    'customerLogout',
    (data: any) => {
      if (data?.type === 'password_changed' || data?.type === 'access_revoked') {
        const eventCustomerId = String(data.customerId || '');
        const currentCustomerId = customerId ? String(customerId) : '';
        
        // Check if this logout event is for the current customer
        if (eventCustomerId === currentCustomerId || 
            (customer && (String(customer._id || '') === eventCustomerId || 
                         String((customer as any).id || '') === eventCustomerId))) {
          console.log('🔐 Logout event received:', data);
          
          // Show notification
          toast({
            variant: "destructive",
            title: "Session Terminated",
            description: data.message || "Your session has been terminated. Please login again.",
          });
          
          // Clear session and redirect to login
          localStorage.removeItem('customer_session');
          setTimeout(() => {
            router.push('/customer/login');
          }, 1500);
        }
      }
    }
  );

  // Listen for price change events to refresh notifications in real-time
  useWebSocket(
    'priceChange',
    () => {
      if (customerId) {
        fetchPriceNotifications(customerId);
      }
    }
  );

  const handleCreateRequestSuccess = () => {
    setIsCreateDialogOpen(false);
    // Refresh requests with fresh data (bypass cache)
    const timestamp = Date.now();
    fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=1000&_t=${timestamp}`), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      }
    })
      .then(res => res.json())
      .then(result => {
        const requests = Array.isArray(result) ? result : (result?.data || []);
        setDeliveryRequests(requests);
        console.log('✅ Customer dashboard: Requests refreshed after creation', requests.length);
      })
      .catch(err => {
        console.error('Error refreshing requests:', err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to refresh requests. Please reload the page.",
        });
      });
    
    toast({
      title: "Request Created",
      description: "Your delivery request has been created successfully!",
    });
  };

  const handleSignOut = () => {
    localStorage.removeItem('customer_session');
    router.push('/customer/login');
  };

  const clearDateFilter = () => {
    setDateFilter({});
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
        <div className="relative z-10">
          <Card className="glass-card">
            <CardContent className="p-8">
              <p className="text-center">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!customer || !customerId) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated gradient background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(63,81,181,0.4),transparent_50%)] animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(48,63,159,0.4),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(63,81,181,0.2),transparent_70%)]"></div>
      
      {/* Animated floating orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>

      <main className="flex-grow relative z-10 p-2 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Header Section - Mobile Responsive */}
          <div className="relative mb-4 md:mb-6">
            {/* 3-Bar Menu Button - Top Left */}
            <div className="absolute top-0 left-0 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(true)}
                className="h-10 w-10"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>

            {/* Sign Out Button - Top Right */}
            <div className="absolute top-0 right-0 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs md:text-sm"
              >
                <LogOut className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
            
            {/* Welcome Message - Centered with padding to avoid overlap */}
            <div className="text-center pt-10 md:pt-0 px-2">
              <h2 className="text-2xl font-normal text-primary mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                The Paani<sup className="text-xs font-normal">™</sup>
              </h2>
              <p className="text-lg font-normal text-muted-foreground mb-0.5" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                Welcome
              </p>
              <h1 className="text-2xl font-normal text-primary break-words" style={{ fontFamily: 'Georgia, serif' }}>
                {customer.name}
              </h1>
            </div>
          </div>

          {/* Create Request Button and Filter - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <Button
              size="lg"
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-to-r from-primary via-accent to-primary hover:from-primary hover:via-accent hover:to-primary shadow-lg hover:shadow-primary/50 transition-all duration-300 w-full sm:w-auto"
              style={{ backgroundSize: '200% auto' }}
            >
              <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Create Request</span>
            </Button>

            <div className="flex items-center gap-2 justify-end sm:justify-start">
              {/* Date Filter Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
                      (dateFilter.from || dateFilter.to) && "bg-primary/10",
                      "h-9 sm:h-10"
                    )}
                  >
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base sm:text-lg">Filter by Date Range</h3>
                      {(dateFilter.from || dateFilter.to) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearDateFilter}
                          className="h-8"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">From Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dateFilter.from && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFilter.from ? format(dateFilter.from, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFilter.from}
                              onSelect={(date) => setDateFilter(prev => ({ ...prev, from: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">To Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dateFilter.to && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFilter.to ? format(dateFilter.to, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFilter.to}
                              onSelect={(date) => setDateFilter(prev => ({ ...prev, to: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Bill Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBillDialogOpen(true)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9 sm:h-10"
              >
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {/* Price Change Notification Bell */}
              <Popover open={notifBellOpen} onOpenChange={handleNotifBellOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9 sm:h-10 relative"
                  >
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                    {notifUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Price Updates</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {priceNotifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                    ) : (
                      priceNotifications.map((n: PriceNotification) => (
                        <div
                          key={n._id}
                          className={cn(
                            'px-4 py-3 border-b last:border-b-0 text-sm',
                            !n.isRead && 'bg-blue-50 dark:bg-blue-950/30'
                          )}
                        >
                          <div className="font-medium text-primary">Price Updated</div>
                          <div className="text-muted-foreground mt-0.5">
                            Your price per can: <span className="line-through">Rs {n.data.oldPrice}</span> → <span className="text-primary font-medium">Rs {n.data.newPrice}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(n.createdAt).toLocaleString('en-PK', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Request History */}
          <CustomerRequestHistory requests={filteredRequests} customer={customer} />
        </div>
      </main>

      {/* Create Request Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[calc(100vh-4rem)] glass-card">
          <DialogHeader>
            <DialogTitle>Create Delivery Request</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-2 py-2">
            <CustomerRequestForm
              customer={customer}
              onSuccess={handleCreateRequestSuccess}
              onClose={() => setIsCreateDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Stats Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent className="sm:max-w-[600px] glass-card">
          <DialogHeader>
            <DialogTitle>Billing Statistics</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Month/Year Selectors */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select
                  value={billMonth.toString()}
                  onValueChange={(value) => setBillMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                    ].map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Year</label>
                <Select
                  value={billYear.toString()}
                  onValueChange={(value) => setBillYear(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats Cards */}
            {isLoadingStats ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-gray-50 border-gray-200">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-10 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Total Deliveries */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-blue-700 font-medium mb-2">Total Deliveries</p>
                    <p className="text-4xl font-bold text-blue-900">{billingStats.totalDeliveries}</p>
                  </CardContent>
                </Card>

                {/* Total Cans Received */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-blue-700 font-medium mb-2">Total Cans Received</p>
                    <p className="text-4xl font-bold text-blue-900">{billingStats.totalCans}</p>
                  </CardContent>
                </Card>

                {/* Price per Can */}
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-green-700 font-medium mb-2">Price per Can</p>
                    <p className="text-4xl font-bold text-green-900">Rs. {billingStats.pricePerCan}</p>
                  </CardContent>
                </Card>

                {/* Total Bill */}
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-green-700 font-medium mb-2">Total Bill</p>
                    <p className="text-4xl font-bold text-green-900">Rs. {billingStats.totalBill}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <Footer />

      {/* Company Info Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px] overflow-y-auto p-0">
          <SheetTitle className="sr-only">PAANI Company Information</SheetTitle>

          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-primary via-primary/90 to-accent px-6 pt-10 pb-8">
            <h1 className="text-4xl font-normal text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
              The Paani<sup className="text-sm font-normal">™</sup>
            </h1>
            <p className="text-sm text-white/80 mt-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              Simple Access to Your PAANI™ Orders
            </p>
          </div>

          <div className="px-5 py-6 space-y-4">
            {/* Description card */}
            <div className="rounded-2xl bg-muted/50 border border-border/60 p-4">
              <p className="text-sm leading-relaxed text-justify" style={{ fontFamily: 'Georgia, serif', color: 'hsl(var(--foreground))' }}>
                <span className="font-semibold italic text-primary">The PAANI™</span> is a trusted mineral water supply brand in{' '}
                <span className="font-semibold text-primary">Larkano</span>, serving homes, offices, and businesses for the past three years.{' '}
                <span className="italic font-medium text-foreground">We deliver clean, safe, and healthy RO-based mineral water, enhanced with <span className="font-semibold text-primary">UV purification</span> to ensure <span className="font-semibold text-primary">100% bacteria-free</span> drinking water,</span>{' '}
                through our <span className="font-bold text-primary">smart Delivery Management System</span> featuring{' '}
                <span className="italic font-medium text-primary">easy one-click ordering</span>,{' '}
                <span className="italic font-medium text-primary">live tracking</span>, and{' '}
                <span className="italic font-medium text-primary">full order history</span>.
              </p>
            </div>

            {/* Address card */}
            <div className="rounded-2xl bg-muted/50 border border-border/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Address</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-9">
                Rahmatpur Latif Colony<br />Near Arfat Masjid, Larkano
              </p>
            </div>

            {/* Contact cards */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary pl-1">Contact Us</span>

              <a
                href="tel:03337860444"
                className="flex items-center gap-3 rounded-2xl bg-muted/50 border border-border/60 p-4 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Call us</p>
                  <p className="text-sm font-semibold text-foreground">0333 786 0 444</p>
                </div>
              </a>

              <a
                href="https://maps.app.goo.gl/Ss9yFHFw6Kg2fh289"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-muted/50 border border-border/60 p-4 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Find us</p>
                  <p className="text-sm font-semibold text-foreground">View on Google Maps</p>
                </div>
              </a>

              <a
                href="https://wa.me/c/923337860444"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border p-4 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#25D36615', borderColor: '#25D36640' }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: '#25D36620' }}>
                  <MessageCircle className="h-4 w-4" style={{ color: '#25D366' }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chat with us</p>
                  <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                </div>
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/923337860444"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-2 right-2 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
        style={{ backgroundColor: '#25D366' }}
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}


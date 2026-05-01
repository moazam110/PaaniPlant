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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Footer from '@/components/shared/Footer';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import type { DeliveryRequest, Customer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, LogOut, Filter, ScrollText, Menu, Phone, MapPin, MessageCircle, Bell, Wallet, Truck } from 'lucide-react';


import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import CustomerRequestForm from './CustomerRequestForm';
import CustomerRequestHistory from './CustomerRequestHistory';
import CustomerBillDialog from './CustomerBillDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { useWebSocket } from '@/hooks/use-websocket';

interface CustomerDashboardClientProps {
  initialRequests: DeliveryRequest[];
}

interface LedgerEntry {
  month: string;
  billed: number;
  appliedToMonth: number;
  dueForMonth: number;
  runningBalance: number;
  status: 'settled' | 'due' | 'advance';
}

export default function CustomerDashboardClient({
  initialRequests
}: CustomerDashboardClientProps) {
  const router = useRouter();
  const { toast, dismiss } = useToast();
  const processingToastDismiss = useRef<(() => void) | null>(null);
  
  // Phase 4: Get customer from authenticated session
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ from?: Date; to?: Date }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);

  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // FIFO ledger + payment records state for wallet popover
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerFinalBalance, setLedgerFinalBalance] = useState(0);
  const [walletPayments, setWalletPayments] = useState<{ _id: string; amount: number; date: string; note: string }[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Unified notification bell state
  type BellNotif =
    | { source: 'price'; _id: string; type: 'price_change'; data: { oldPrice: number; newPrice: number }; isRead: boolean; createdAt: string }
    | { source: 'payment'; _id: string; type: 'payment_added' | 'payment_deleted'; amount: number; note: string; deleteReason?: string; isReadByCustomer: boolean; createdAt: string };
  const [bellNotifs, setBellNotifs] = useState<BellNotif[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifBellOpen, setNotifBellOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'payments' | 'price'>('all');

  // Fetch customer-specific paginated requests
  const fetchRequests = async (id: string, page: number, append: boolean = false) => {
    if (append) setIsLoadingMore(true);
    try {
      const timestamp = Date.now();
      const response = await fetch(
        buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?customerId=${id}&page=${page}&limit=50&_t=${timestamp}`),
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      );
      if (response.ok) {
        const result = await response.json();
        const data: DeliveryRequest[] = Array.isArray(result) ? result : (result?.data || []);
        const pagination = result.pagination || { hasNext: false };
        if (append) {
          setDeliveryRequests(prev => {
            const existingIds = new Set(prev.map(r => r._id || r.requestId));
            return [...prev, ...data.filter(r => !existingIds.has(r._id || r.requestId))];
          });
        } else {
          setDeliveryRequests(data);
        }
        setCurrentPage(page);
        setHasMore(pagination.hasNext || false);
      }
    } catch (error) {
      console.error('Error fetching delivery requests:', error);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Fetch requests once customerId is known
  useEffect(() => {
    if (customerId) {
      fetchRequests(customerId, 1);
    }
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Filter requests by date range (customerId filter handled by backend)
  const filteredRequests = useMemo(() => {
    if (!customerId) return [];

    let filtered = [...deliveryRequests];

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


  // Fetch both notification types and merge for bell
  const fetchBellNotifs = useCallback(async (objectId: string, markRead = false) => {
    try {
      const [priceRes, payRes] = await Promise.all([
        fetch(buildApiUrl(`api/notifications/customer/${objectId}`)),
        fetch(buildApiUrl(`api/payment-notifications/customer/${objectId}`)),
      ]);
      const merged: BellNotif[] = [];
      if (priceRes.ok) {
        const d = await priceRes.json();
        for (const n of (d.notifications || [])) merged.push({ source: 'price', ...n });
      }
      if (payRes.ok) {
        const d = await payRes.json();
        for (const n of (d.data || [])) merged.push({ source: 'payment', ...n });
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBellNotifs(merged);
      const unread = merged.filter(n => n.source === 'price' ? !n.isRead : !n.isReadByCustomer).length;
      setNotifUnreadCount(unread);
      if (markRead && unread > 0) {
        Promise.all([
          fetch(buildApiUrl(`api/notifications/customer/${objectId}/read-all`), { method: 'PUT' }),
          fetch(buildApiUrl(`api/payment-notifications/customer/${objectId}/read-all`), { method: 'PUT' }),
        ]).catch(() => {});
        setBellNotifs(prev => prev.map(n =>
          n.source === 'price' ? { ...n, isRead: true } : { ...n, isReadByCustomer: true }
        ));
        setNotifUnreadCount(0);
      }
    } catch { /* non-critical */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load bell notifs once customer object ID is known
  useEffect(() => {
    if (customer) {
      const objectId = (customer as any)._id || customerId;
      if (objectId) fetchBellNotifs(String(objectId));
    }
  }, [customer, customerId, fetchBellNotifs]);

  // Fetch FIFO ledger + payment records for wallet popover (no notifs — those are in the bell)
  const fetchLedger = useCallback(async (objectId: string) => {
    setIsLoadingLedger(true);
    try {
      const [ledgerRes, paymentsRes] = await Promise.all([
        fetch(buildApiUrl(`api/payments/ledger/${objectId}`)),
        fetch(buildApiUrl(`api/payments?customerObjectId=${objectId}`)),
      ]);
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger((data.data?.ledger || []).slice().reverse());
        setLedgerFinalBalance(data.data?.finalBalance ?? 0);
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setWalletPayments(data.data || []);
      }
    } catch { /* non-critical */ } finally {
      setIsLoadingLedger(false);
    }
  }, []);

  // Handle bell open: fetch fresh and mark as read
  const handleNotifBellOpen = async (open: boolean) => {
    setNotifBellOpen(open);
    if (open && customer) {
      const objectId = String((customer as any)._id || customerId || '');
      if (objectId) await fetchBellNotifs(objectId, true);
    }
  };

  // Real-time updates via WebSocket - sync with admin dashboard
  useWebSocket(
    'deliveryRequests',
    (data: any) => {
      if (data?.type === 'created' || data?.type === 'updated' || data?.type === 'deleted') {
        if (customerId) {
          fetchRequests(customerId, 1);
        }
      }
      if (customerId && String(data?.data?.customerId) === customerId) {
        // Show persistent popup when this customer's request moves to processing
        if (data?.type === 'updated' && data?.data?.status === 'processing') {
          const { dismiss: dismissThis } = toast({
            title: "Your water cans are on the way!",
            description: "Our delivery team has confirmed your order and is heading to you.",
            duration: Infinity,
          });
          processingToastDismiss.current = dismissThis;
        }
        // Dismiss the popup when delivered
        if (data?.type === 'updated' && data?.data?.status === 'delivered') {
          if (processingToastDismiss.current) {
            processingToastDismiss.current();
            processingToastDismiss.current = null;
          }
        }
      }
    }
  );

  // Listen for payment activity — refresh bell badge
  useWebSocket(
    'paymentActivity',
    (data: any) => {
      if (data?.customerId && customer) {
        const objectId = String((customer as any)._id || customerId || '');
        if (data.customerId === objectId) fetchBellNotifs(objectId);
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

  // Listen for price change events — refresh bell
  useWebSocket(
    'priceChange',
    () => {
      if (customer) {
        const objectId = String((customer as any)._id || customerId || '');
        if (objectId) fetchBellNotifs(objectId);
      }
    }
  );

  const handleCreateRequestSuccess = () => {
    setIsCreateDialogOpen(false);
    if (customerId) fetchRequests(customerId, 1);
    toast({ title: "Request Created", description: "Your delivery request has been created successfully!" });
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
      {/* Deep gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-accent/35 to-primary/60 animate-gradient"></div>
      {/* Radial depth layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(63,81,181,0.5),transparent_50%)] animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(48,63,159,0.45),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.07),transparent_40%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(63,81,181,0.2),transparent_70%)]"></div>
      {/* Diagonal light ray */}
      <div className="absolute inset-0 light-ray"></div>
      {/* Animated floating orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

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

            {/* Bell + Sign Out - Top Right */}
            <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
              {/* Unified Notification Bell */}
              <Popover open={notifBellOpen} onOpenChange={handleNotifBellOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 relative">
                    <Bell className="h-5 w-5" />
                    {notifUnreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="px-4 py-3 border-b">
                    <p className="font-semibold text-sm mb-2">Notifications</p>
                    <div className="flex gap-1">
                      {(['all', 'payments', 'price'] as const).map(f => (
                        <button key={f} onClick={() => setNotifFilter(f)}
                          className={cn('text-xs px-2 py-0.5 rounded-full border transition-colors',
                            notifFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'
                          )}>
                          {f === 'all' ? 'All' : f === 'payments' ? 'Payments' : 'Price Updates'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {(() => {
                      const visible = bellNotifs.filter(n =>
                        notifFilter === 'all' ? true : notifFilter === 'payments' ? n.source === 'payment' : n.source === 'price'
                      );
                      if (visible.length === 0) return (
                        <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                      );
                      return visible.map(n => {
                        const unread = n.source === 'price' ? !n.isRead : !n.isReadByCustomer;
                        return (
                          <div key={n._id} className={cn(
                            'px-4 py-3 border-b last:border-b-0',
                            n.source === 'payment' && n.type === 'payment_deleted' && 'bg-destructive/5',
                            unread && 'bg-primary/5',
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {n.source === 'price' ? (
                                  <>
                                    <p className="text-xs font-semibold text-primary">Price Updated</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Per can: <span className="line-through">Rs {n.data.oldPrice}</span> → <span className="font-medium text-primary">Rs {n.data.newPrice}</span>
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className={cn('text-xs font-semibold', n.type === 'payment_deleted' ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
                                      {n.type === 'payment_added' ? `Rs ${n.amount.toLocaleString()} payment received` : `Rs ${n.amount.toLocaleString()} payment deleted`}
                                    </p>
                                    {n.note && <p className="text-xs text-muted-foreground mt-0.5">{n.note}</p>}
                                    {n.type === 'payment_deleted' && n.deleteReason && (
                                      <p className="text-xs text-destructive/80 mt-0.5 font-medium">Reason: {n.deleteReason}</p>
                                    )}
                                  </>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(n.createdAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })}
                                </p>
                              </div>
                              {unread && <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </PopoverContent>
              </Popover>

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
              <h2 className="text-2xl font-normal mb-1 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif', color: 'hsl(231,55%,28%)' }}>
                The Paani<sup className="text-xs font-normal">™</sup>
              </h2>
              {/* Decorative accent line */}
              <div className="flex items-center justify-center gap-2 my-1.5">
                <div className="h-px w-10 bg-gradient-to-r from-transparent to-primary/50 rounded-full" />
                <div className="h-1 w-1 rounded-full bg-primary/60" />
                <div className="h-px w-10 bg-gradient-to-l from-transparent to-primary/50 rounded-full" />
              </div>
              <p className="text-base font-normal text-muted-foreground mb-0.5" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                Welcome
              </p>
              <h1 className="text-2xl font-normal text-primary break-words drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                {customer.name}
              </h1>
            </div>
          </div>

          {/* Create Request Button and Filter - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="btn-shimmer w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full text-white font-semibold text-sm shadow-lg active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(to right, hsl(231,48%,38%), hsl(231,53%,30%), hsl(220,60%,55%), hsl(231,48%,38%))' }}
            >
              <Truck className="h-5 w-5" />
              Request Delivery
            </button>

            <div className="flex items-center justify-end sm:justify-start w-full sm:w-auto">
              {/* Rotate hint - portrait only, pushed far left */}
              {isPortrait && (
                <span className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full border border-primary/40 bg-primary/10 text-primary mr-auto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <rect x="7.5" y="3" width="9" height="18" rx="2" transform="rotate(-45 12 12)" />
                    <path d="M16.5 3.5 A9.5 9.5 0 0 1 20.5 7.5" />
                    <path d="M18 6 L20.5 7.5 L19 10" />
                    <path d="M7.5 20.5 A9.5 9.5 0 0 1 3.5 16.5" />
                    <path d="M6 18 L3.5 16.5 L5 14" />
                  </svg>
                </span>
              )}
              <div className="flex items-center gap-2">
              {/* Account Balance (Wallet) */}
              <Popover open={balancePopoverOpen} onOpenChange={(open) => {
                setBalancePopoverOpen(open);
                if (open && customer) {
                  const objectId = (customer as any)._id || customerId;
                  if (objectId) fetchLedger(String(objectId));
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9 sm:h-10 px-2 sm:px-3 gap-1.5">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs font-medium">Account</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Account Balance</span>
                  </div>
                  {isLoadingLedger ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
                  ) : (
                    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                      {/* Top balance — single centered line */}
                      <div className={cn(
                        'rounded-lg px-3 py-2.5 text-sm font-semibold text-center',
                        ledgerFinalBalance < 0 && 'bg-destructive/10 text-destructive',
                        ledgerFinalBalance > 0 && 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
                        ledgerFinalBalance === 0 && 'bg-muted/40 text-muted-foreground',
                      )}>
                        {ledgerFinalBalance < 0 ? `Rs ${Math.abs(ledgerFinalBalance).toLocaleString()} DUE`
                          : ledgerFinalBalance > 0 ? `Rs ${ledgerFinalBalance.toLocaleString()} ADV`
                          : 'All Settled'}
                      </div>

                      {ledger.length > 0 && (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Monthly Summary</p>
                          {ledger.map(entry => {
                            const [y, mo] = entry.month.split('-');
                            const label = new Date(Number(y), Number(mo) - 1, 15).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
                            return (
                              <div key={entry.month} className="rounded-lg border bg-card px-3 py-2">
                                <p className="text-xs font-semibold text-foreground">{label}</p>
                                <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-3">
                                  <span className="font-medium text-foreground">Billed Rs {entry.billed.toLocaleString()}</span>
                                  {entry.appliedToMonth > 0 && entry.appliedToMonth < entry.billed && (
                                    <span className="font-semibold text-green-600 dark:text-green-400">· Paid Rs {entry.appliedToMonth.toLocaleString()}</span>
                                  )}
                                  {entry.appliedToMonth === entry.billed && entry.billed > 0 && (
                                    <span className="font-semibold text-green-600 dark:text-green-400">· Fully Paid</span>
                                  )}
                                  {entry.status === 'due' && (
                                    <span className="font-black text-destructive whitespace-nowrap">· Rs {entry.dueForMonth.toLocaleString()} DUE</span>
                                  )}
                                  {entry.status === 'advance' && (
                                    <span className="font-black text-green-600 dark:text-green-400 whitespace-nowrap">· Rs {Math.abs(entry.runningBalance).toLocaleString()} ADV</span>
                                  )}
                                  {entry.status === 'settled' && (
                                    <span className="font-bold text-muted-foreground">· ✓ Settled</span>
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </>
                      )}
                      {walletPayments.length > 0 && (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Payment Records</p>
                          {walletPayments.map(p => (
                            <div key={p._id} className="rounded-lg border bg-card px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-green-600 dark:text-green-400">Rs {p.amount.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(p.date).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })}
                                </p>
                              </div>
                              {p.note && <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>}
                            </div>
                          ))}
                        </>
                      )}
                      {ledger.length === 0 && walletPayments.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">No history yet.</p>
                      )}
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Bill Button */}
              <Button
                variant="outline" size="sm"
                onClick={() => setIsBillDialogOpen(true)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9 sm:h-10 px-2 sm:px-3 gap-1.5"
              >
                <ScrollText className="h-4 w-4" />
                <span className="text-xs font-medium">Bill</span>
              </Button>

              {/* Date Filter Popover - rightmost */}
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
                        <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
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
                              onSelect={(date) => { setDateFilter(prev => ({ ...prev, from: date, to: prev.to ?? (date ? new Date() : undefined) })); setFromDateOpen(false); }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">To Date</label>
                        <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
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
                              onSelect={(date) => { setDateFilter(prev => ({ ...prev, to: date })); setToDateOpen(false); }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              </div>

            </div>
          </div>

          {/* Request History */}
          <CustomerRequestHistory
            requests={filteredRequests}
            customer={customer}
            hasMore={hasMore && !dateFilter.from && !dateFilter.to}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => { if (customerId) fetchRequests(customerId, currentPage + 1, true); }}
          />
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

      {/* Bill Dialog */}
      {customer && customerId && (
        <CustomerBillDialog
          open={isBillDialogOpen}
          onOpenChange={setIsBillDialogOpen}
          customer={customer}
          customerId={customerId}
        />
      )}

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

    </div>
  );
}


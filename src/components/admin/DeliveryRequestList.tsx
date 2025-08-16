
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { Customer, DeliveryRequest } from '@/types';
// REMOVE: import { db } from '@/lib/firebase';
// REMOVE: import { collection, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertTriangle, PlusCircle, Pencil, CheckCircle, XCircle, Ban, Star, ArrowUpAZ, ArrowDownAZ, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListFilter } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";


interface DeliveryRequestListProps {
  onInitiateNewRequest: (customer?: Customer) => void;
  onEditRequest: (request: DeliveryRequest) => void;
  deliveryRequests: DeliveryRequest[];
  setDeliveryRequests: React.Dispatch<React.SetStateAction<DeliveryRequest[]>>;
}

// Fuzzy search function
const fuzzySearch = (text: string, query: string): boolean => {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (queryLower.length === 0) return true;
  
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length;
};

const DeliveryRequestList: React.FC<DeliveryRequestListProps> = ({ onInitiateNewRequest, onEditRequest, deliveryRequests, setDeliveryRequests }) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<{ today: boolean; date: string; cash: boolean; account: boolean; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; cancelled: boolean }>({ today: false, date: '', cash: false, account: false, cans: '', cansOp: '=', price: '', priceOp: '>', cancelled: false });
  const [activeFilter, setActiveFilter] = useState<{ today: boolean; date: string; cash: boolean; account: boolean; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; cancelled: boolean }>({ today: false, date: '', cash: false, account: false, cans: '', cansOp: '=', price: '', priceOp: '>', cancelled: false });
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Cancellation state
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<DeliveryRequest | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('door_closed');
  const [cancellationNotes, setCancellationNotes] = useState<string>('');

  // Removed auto-clear: keep user input to avoid retyping when creating multiple city-specific requests
  // useEffect(() => {
  //   if (searchTerm.trim()) {
  //     setSearchTerm('');
  //   }
  // }, [deliveryRequests.length]);

  useEffect(() => {
    setIsLoadingCustomers(true);
    fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS))
      .then(res => res.json())
      .then((data) => {
        setAllCustomers(data);
        setIsLoadingCustomers(false);
        setError(null);
      })
      .catch((err) => {
        setError('Failed to fetch customers.');
        setIsLoadingCustomers(false);
      });
  }, []);

  // Optimized status order calculation - memoized to avoid recalculation
  const getStatusOrderValue = useCallback((status: DeliveryRequest['status']) => {
    if (status === 'pending_confirmation') return 0;
    if (status === 'pending') return 1;
    if (status === 'processing') return 2;
    if (status === 'delivered') return 3;
    if (status === 'cancelled') return 4;
    return 5;
  }, []);

  // Optimized date comparison - memoized to avoid Date object creation
  const isSameDay = useCallback((date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }, []);

  // Pre-compute date references to avoid recreation
  const todayRef = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const specificRef = useMemo(() => {
    if (!activeFilter.date) return null;
    const specific = new Date(activeFilter.date);
    specific.setHours(0, 0, 0, 0);
    return specific;
  }, [activeFilter.date]);

  // Optimized processed requests with better memoization
  const processedRequests = useMemo(() => {
    if (!deliveryRequests.length) return [];
    
    return [...deliveryRequests].sort((a, b) => {
      const orderA = getStatusOrderValue(a.status);
      const orderB = getStatusOrderValue(b.status);

      if (orderA !== orderB) return orderA - orderB;

      // Within the same status group, prioritize urgent for active requests
      if (a.status === 'pending' || a.status === 'pending_confirmation' || a.status === 'processing') {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      }
      
      // Use pre-computed timestamps to avoid Date object creation
      const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [deliveryRequests, getStatusOrderValue]);


  const filteredDeliveryRequests = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      return processedRequests;
    }

    // If numeric input, match strictly by integer id
    if (/^\d+$/.test(trimmed)) {
      const idNum = Number(trimmed);
      return processedRequests.filter(req => (req as any).customerIntId === idNum);
    }
    
    // Fuzzy search implementation
    return processedRequests.filter(request => {
      const searchLower = trimmed.toLowerCase();
      const matchesCustomerName = fuzzySearch(request.customerName, searchLower);
      const matchesAddress = fuzzySearch(request.address, searchLower);
      const statusDisplay = request.status === 'pending' ? 'pending' : request.status;
      const matchesStatus = statusDisplay.toLowerCase().includes(searchLower);
      const matchesPriority = request.priority.toLowerCase().includes(searchLower);
      return matchesCustomerName || matchesAddress || matchesStatus || matchesPriority;
    });
  }, [processedRequests, searchTerm]);

  // Apply panel filters after search filtering - optimized version
  const fullyFilteredRequests = useMemo(() => {
    const list = filteredDeliveryRequests;
    const { today, date, cash, account, cans, cansOp, price, priceOp, cancelled } = activeFilter;

    // Early return if no filters are active
    const hasDateFilter = today;
    const hasPaymentFilter = cash || account;
    const cansFilterVal = cans && /^\d{1,2}$/.test(cans) ? Number(cans) : null;
    const priceFilterVal = price && /^\d{1,3}$/.test(price) ? Number(price) : null;
    const hasSpecificDate = !!date;
    
    if (!hasDateFilter && !hasSpecificDate && !hasPaymentFilter && cansFilterVal == null && priceFilterVal == null && !cancelled) {
      return list;
    }

    // Use memoized date references and comparison function
    return list.filter(req => {
      // Date filter: apply only to delivered history
      if (hasDateFilter || hasSpecificDate) {
        if (req.status !== 'delivered') return false;
        const deliveredTime = (req as any).deliveredAt || (req as any).completedAt;
        if (!deliveredTime) return false;
        
        const d = new Date(deliveredTime);
        d.setHours(0, 0, 0, 0);
        
        const matchToday = today && isSameDay(d, todayRef);
        const matchSpecific = hasSpecificDate && specificRef ? isSameDay(d, specificRef) : false;
        
        if (!(matchToday || matchSpecific)) return false;
      }

      // Payment filter
      if (hasPaymentFilter) {
        const pt = ((req as any).paymentType || '').toString().toLowerCase();
        const isCash = pt === 'cash';
        const isAccount = pt === 'account';
        if (cash && !isCash) return false;
        if (account && !isAccount) return false;
      }

      // Cans filter with operator
      if (cansFilterVal != null) {
        const current = Number(req.cans);
        const op = cansOp || '=';
        if (op === '<' && !(current < cansFilterVal)) return false;
        if (op === '=' && !(current === cansFilterVal)) return false;
        if (op === '>' && !(current > cansFilterVal)) return false;
      }

      // Price filter
      if (priceFilterVal != null) {
        const p = (req as any).pricePerCan;
        if (typeof p !== 'number') return false;
        const op = priceOp || '=';
        if (op === '<' && !(p < priceFilterVal)) return false;
        if (op === '=' && !(p === priceFilterVal)) return false;
        if (op === '>' && !(p > priceFilterVal)) return false;
      }

      // Cancelled filter
      if (cancelled) {
        if (req.status !== 'cancelled') return false;
      }

      return true;
    });
  }, [filteredDeliveryRequests, activeFilter, todayRef, specificRef, isSameDay]);

  // Separate optimized address sorting
  const sortedRequests = useMemo(() => {
    if (!addressSortOrder) return fullyFilteredRequests;
    
    const dir = addressSortOrder === 'asc' ? 1 : -1;
    return [...fullyFilteredRequests].sort((a, b) => {
      const aAddr = (a.address || '').toString().toLowerCase();
      const bAddr = (b.address || '').toString().toLowerCase();
      
      if (aAddr < bAddr) return -1 * dir;
      if (aAddr > bAddr) return 1 * dir;
      
      // tie-breaker: urgent first within same address for active requests
      if ((a.status === 'pending' || a.status === 'processing') && (b.status === 'pending' || b.status === 'processing')) {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      }
      
      // final tie-breaker by requestedAt oldest first
      const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return ta - tb;
    });
  }, [fullyFilteredRequests, addressSortOrder]);

  const customersForNewRequest = useMemo(() => {
    const trimmed = searchTerm.trim();
    // If numeric input, match by exact customer id
    if (trimmed && /^\d+$/.test(trimmed)) {
      const idNum = Number(trimmed);
      const customersWithActiveRequests = new Set(
        deliveryRequests
          .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
          .map(req => {
            const raw = (req as any).customerId;
            return raw && typeof raw === 'object'
              ? String(raw._id ?? raw.id ?? '')
              : String(raw ?? '');
          })
      );
      return allCustomers.filter(c => (c as any).id === idNum && !customersWithActiveRequests.has(c._id || (c as any).customerId || ''));
    }

    if (!trimmed) return [];

    const searchLower = trimmed.toLowerCase();
    const customersWithActiveRequests = new Set(
      deliveryRequests
        .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
        .map(req => {
          const raw = (req as any).customerId;
          return raw && typeof raw === 'object'
            ? String(raw._id ?? raw.id ?? '')
            : String(raw ?? '');
        })
    );

    return allCustomers
      .filter(customer => {
        const matchesName = fuzzySearch(customer.name, searchLower);
        const matchesPhone = customer.phone ? fuzzySearch(customer.phone, searchLower) : false;
        const matchesAddress = fuzzySearch(customer.address, searchLower);
        const rawCust = (customer as any)._id || (customer as any).customerId;
        const normalizedCust = rawCust && typeof rawCust === 'object'
          ? String(rawCust._id ?? rawCust.id ?? '')
          : String(rawCust ?? '');
        const hasNoActiveRequest = !customersWithActiveRequests.has(normalizedCust || '');
        return (matchesName || matchesPhone || matchesAddress) && hasNoActiveRequest;
      });
  }, [allCustomers, deliveryRequests, searchTerm]);

  const handleCreateRequest = (customer: Customer) => {
    onInitiateNewRequest(customer);
    // Keep search term and cursor; do not clear automatically
  };

  const handleCancelRequest = async () => {
    if (!cancellingRequest) return;

    try {
      const response = await fetch(buildApiUrl(`api/delivery-requests/${cancellingRequest._id || cancellingRequest.requestId}/cancel`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancellationReason,
          notes: cancellationNotes,
          cancelledBy: 'admin'
        }),
      });

      if (response.ok) {
        const cancelledRequest = await response.json();
        setDeliveryRequests(prev => prev.map(req =>
          (req._id || req.requestId) === (cancellingRequest._id || cancellingRequest.requestId) 
            ? { ...req, ...cancelledRequest } 
            : req
        ));
        toast({
          title: "Request Cancelled",
          description: "The delivery request has been cancelled successfully.",
        });
        setIsCancelDialogOpen(false);
        setCancellingRequest(null);
        setCancellationReason('door_closed');
        setCancellationNotes('');
      } else {
        throw new Error('Failed to cancel request');
      }
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast({
        variant: "destructive",
        title: "Cancellation Failed",
        description: "Could not cancel the request. Please try again.",
      });
    }
  };

  const openCancelDialog = (request: DeliveryRequest) => {
    // Only allow cancellation of pending or processing requests
    if (request.status !== 'pending' && request.status !== 'pending_confirmation' && request.status !== 'processing') {
      toast({
        variant: "destructive",
        title: "Cannot Cancel",
        description: "Only pending or processing requests can be cancelled.",
      });
      return;
    }
    setCancellingRequest(request);
    setIsCancelDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: DeliveryRequest['status']) => {
    switch (status) {
      case 'pending': return 'default'; 
      case 'pending_confirmation': return 'secondary';
      case 'processing': return 'default'; // Added processing variant
      case 'delivered': return 'outline'; 
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

   const getPriorityIcon = (priority: DeliveryRequest['priority']) => {
    if (priority === 'urgent') {
      return <AlertTriangle className="h-4 w-4 text-destructive inline-block mr-1" />;
    }
    return null;
  };

  // Display "Pending" instead of "planned"
  const getStatusDisplay = (status: DeliveryRequest['status']) => {
    if (status === 'pending') return 'Pending';
    return status.replace('_', ' ');
  }
  
  const getStatusIcon = (status: DeliveryRequest['status']) => {
    if (status === 'delivered') return <CheckCircle className="h-4 w-4 text-green-600 inline-block mr-1" />;
    if (status === 'cancelled') return <XCircle className="h-4 w-4 text-destructive inline-block mr-1" />;
    return null;
  }

  const isLoading = false; // No longer loading mock data

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-10 w-full md:w-1/2 lg:w-1/3" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-2 border rounded-md">
            <div className="space-y-1 flex-grow">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive mt-4 text-center">{error}</p>;
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="relative mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
              placeholder="Search by id, name, phone, or address..."
          value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === '\\') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="pl-10 w-full"
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Filters">
                <ListFilter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Date</Label>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-2">
                      <Checkbox id="flt-today" checked={filterDraft.today} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, today: !!v }))} />
                      <Label htmlFor="flt-today">Today</Label>
                    </div>
                    <Input
                      id="flt-date"
                      type="date"
                      value={filterDraft.date}
                      onChange={(e) => setFilterDraft(prev => ({ ...prev, date: e.target.value }))}
                      className="w-36"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Payment Type</Label>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox id="flt-cash" checked={filterDraft.cash} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, cash: !!v }))} />
                      <Label htmlFor="flt-cash">Cash</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="flt-account" checked={filterDraft.account} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, account: !!v }))} />
                      <Label htmlFor="flt-account">Account</Label>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Cans (optional)</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <Select value={filterDraft.cansOp} onValueChange={(v) => setFilterDraft(prev => ({ ...prev, cansOp: v as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">Greater</SelectItem>
                          <SelectItem value="=">Equal</SelectItem>
                          <SelectItem value="<">Less</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="e.g., 12"
                      value={filterDraft.cans}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D+/g, '').slice(0, 2);
                        setFilterDraft(prev => ({ ...prev, cans: digits }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Price (optional)</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-24">
                      <Select value={filterDraft.priceOp} onValueChange={(v) => setFilterDraft(prev => ({ ...prev, priceOp: v as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">Greater</SelectItem>
                          <SelectItem value="=">Equal</SelectItem>
                          <SelectItem value="<">Less</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      placeholder="e.g., 100"
                      value={filterDraft.price}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D+/g, '').slice(0, 3);
                        setFilterDraft(prev => ({ ...prev, price: digits }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Cancelled</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox id="flt-cancelled" checked={filterDraft.cancelled} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, cancelled: !!v }))} />
                    <Label htmlFor="flt-cancelled">Only Show Cancelled</Label>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Address Sort</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={addressSortOrder === 'asc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAddressSortOrder(prev => (prev === 'asc' ? null : 'asc'))}
                      title="Ascending"
                    >
                      <ArrowUpAZ className="h-4 w-4 mr-1" /> Asc
                    </Button>
                    <Button
                      type="button"
                      variant={addressSortOrder === 'desc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAddressSortOrder(prev => (prev === 'desc' ? null : 'desc'))}
                      title="Descending"
                    >
                      <ArrowDownAZ className="h-4 w-4 mr-1" /> Desc
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setFilterDraft({ today: false, date: '', cash: false, account: false, cans: '', cansOp: '=', price: '', priceOp: '>', cancelled: false }); }}>Clear</Button>
                  <Button onClick={() => { setActiveFilter(filterDraft); setIsFilterOpen(false); }}>Apply</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Customer suggestions for new request on TOP */}
      {searchTerm && customersForNewRequest.length > 0 && (
          <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Create New Request for:</h4>
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              {customersForNewRequest.map(customer => (
                  <Card key={customer._id || customer.customerId || `customer-${Math.random()}`} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex justify-between items-center">
                          <div>
                                  <p className={cn("font-medium", /[ء-ي]/.test(customer.name) ? 'font-sindhi rtl' : 'ltr')}>
                                    {(customer as any).id ? `${(customer as any).id} - ${customer.name}` : customer.name}
                                  </p>
                              <p className="text-xs text-muted-foreground">{customer.address}</p>
                          </div>
                          <Button size="sm" onClick={() => handleCreateRequest(customer)}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Create Request
                          </Button>
                      </CardContent>
                  </Card>
              ))}
              </div>
              </ScrollArea>
          </div>
      )}

      {fullyFilteredRequests.length === 0 && !searchTerm && (
         <p className="text-muted-foreground mt-4 text-center">No delivery requests. Use search to find customers for new requests.</p>
      )}
      {fullyFilteredRequests.length === 0 && searchTerm && customersForNewRequest.length === 0 && (
         <p className="text-muted-foreground mt-4 text-center">No requests or customers found matching "{searchTerm}".</p>
      )}

      {/* Cancelled filter info message */}
      {activeFilter.cancelled && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Viewing Cancelled Requests Only
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>This view shows only cancelled delivery requests with their cancellation details including reason, notes, and who cancelled them.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {sortedRequests.length > 0 && (
        <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Cans</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-[10%] text-center whitespace-nowrap">Price</TableHead>
                <TableHead className="w-[10%] text-center whitespace-nowrap">Payment Type</TableHead>
                <TableHead className="w-[10%] text-center whitespace-nowrap">Priority</TableHead>
                <TableHead className="w-[10%] text-center whitespace-nowrap">Status</TableHead>
                {activeFilter.cancelled && (
                  <>
                    <TableHead className="w-[12%] text-center whitespace-nowrap">Cancelled By</TableHead>
                    <TableHead className="w-[12%] text-center whitespace-nowrap">Reason</TableHead>
                    <TableHead className="w-[15%] text-center whitespace-nowrap">Notes</TableHead>
                  </>
                )}
                <TableHead className="w-[10%] text-center whitespace-nowrap">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request, index) => {
                const isSindhiName = /[ء-ي]/.test(request.customerName);
                const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                const isCancelled = request.status === 'cancelled';
                const isDelivered = request.status === 'delivered';
                const canEdit = request.status === 'pending' || request.status === 'processing';
                const rowClasses = cn(
                    isCancelled ? 'opacity-60 bg-muted/30' : '',
                    isDelivered ? 'bg-green-500/10' : '',
                    request.status === 'processing' ? 'bg-yellow-100' : ''
                );
                
                const pricePerCan = (request as any).pricePerCan;
                const paymentType = ((request as any).paymentType || '').toString();
                const intId = (request as any).customerIntId;

                return (
                  <TableRow key={request._id || request.requestId || `req-${Math.random()}`} className={rowClasses}>
                    <TableCell className={cn(nameClasses, isCancelled && 'line-through')}>
                        {intId ? `${intId} - ${request.customerName}` : request.customerName}
                    </TableCell>
                    <TableCell className={cn("text-center", isCancelled && 'line-through')}>{request.cans}</TableCell>
                    <TableCell className={cn(isCancelled ? 'line-through' : '')}>
                      {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                    <TableCell className={cn("whitespace-normal break-words max-w-xs", isCancelled && 'line-through')}>
                        {request.address}
                    </TableCell>
                    <TableCell className="w-[10%] text-center whitespace-nowrap">{pricePerCan !== undefined ? `Rs. ${pricePerCan}` : '-'}</TableCell>
                    <TableCell className="w-[10%] text-center whitespace-nowrap">
                      {paymentType ? (
                        <Badge variant="outline" className="capitalize whitespace-nowrap">{paymentType}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className={cn('w-[10%] text-center whitespace-nowrap', isCancelled ? 'line-through' : '')}>
                      {getPriorityIcon(request.priority)}
                      <span className="capitalize">{request.priority}</span>
                    </TableCell>
                    <TableCell className="w-[10%] text-center whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                        {getStatusIcon(request.status)}
                        {getStatusDisplay(request.status)}
                      </Badge>
                    </TableCell>
                    {activeFilter.cancelled && (
                      <>
                        <TableCell className="w-[12%] text-center whitespace-nowrap">
                          {request.cancelledBy || '-'}
                        </TableCell>
                        <TableCell className="w-[12%] text-center whitespace-nowrap">
                          {request.cancellationReason || '-'}
                        </TableCell>
                        <TableCell className="w-[15%] text-center whitespace-nowrap">
                          {request.cancellationNotes || '-'}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="w-[10%] text-center whitespace-nowrap">
                      {canEdit ? (
                        <Button variant="ghost" size="icon" title="Edit Request" onClick={() => onEditRequest(request)}>
                            <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {(request.status === 'pending' || request.status === 'pending_confirmation' || request.status === 'processing') && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Cancel Request" 
                          onClick={() => openCancelDialog(request)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile view for cancelled requests */}
      {activeFilter.cancelled && (
        <div className="md:hidden space-y-3 mt-6">
          <h3 className="text-lg font-semibold">Cancelled Requests (Mobile View)</h3>
          {sortedRequests.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm border rounded">
              No cancelled requests found.
            </div>
          ) : (
            sortedRequests.map((request) => {
              const isSindhiName = /[ء-ي]/.test(request.customerName);
              const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
              const intId = (request as any).customerIntId;
              const pricePerCan = (request as any).pricePerCan;
              const paymentType = ((request as any).paymentType || '').toString();

              return (
                <Card key={request._id || request.requestId || `mobile-${Math.random()}`} className="shadow-sm border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className={cn(nameClasses, 'font-medium text-base')}>
                            {intId ? `${intId} - ${request.customerName}` : request.customerName}
                          </h4>
                          <p className="text-sm text-muted-foreground">{request.address}</p>
                        </div>
                        <Badge variant="destructive" className="capitalize">
                          Cancelled
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cans:</span> {request.cans}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price:</span> {pricePerCan !== undefined ? `Rs. ${pricePerCan}` : '-'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Payment:</span> {paymentType ? (
                            <Badge variant="outline" className="capitalize ml-1">{paymentType}</Badge>
                          ) : '-'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Requested:</span> {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, HH:mm') : '-'}
                        </div>
                      </div>

                      {/* Cancellation details */}
                      <div className="border-t pt-3 space-y-2 bg-white rounded p-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground font-medium">Cancelled By:</span> 
                          <span className="ml-2 capitalize">{request.cancelledBy || '-'}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground font-medium">Reason:</span> 
                          <span className="ml-2 capitalize">{request.cancellationReason || '-'}</span>
                        </div>
                        {request.cancellationNotes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground font-medium">Notes:</span> 
                            <span className="ml-2">{request.cancellationNotes}</span>
                          </div>
                        )}
                        {request.cancelledAt && (
                          <div className="text-sm">
                            <span className="text-muted-foreground font-medium">Cancelled At:</span> 
                            <span className="ml-2">{format(new Date(request.cancelledAt), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Cancellation Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cancel Delivery Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cancellingRequest && (
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="font-medium">{cancellingRequest.customerName}</p>
                <p className="text-sm text-muted-foreground">
                  {cancellingRequest.cans} cans • {cancellingRequest.address}
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
              <Select value={cancellationReason} onValueChange={setCancellationReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="door_closed">Door Closed</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cancellation-notes">Additional Notes (Optional)</Label>
              <Textarea
                id="cancellation-notes"
                placeholder="Provide additional details about the cancellation..."
                value={cancellationNotes}
                onChange={(e) => setCancellationNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleCancelRequest}>
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryRequestList;


"use client";

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import type { Customer, DeliveryRequest } from '@/types';
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
import { Search, AlertTriangle, PlusCircle, Pencil, CheckCircle, XCircle, ArrowUpAZ, ArrowDownAZ, X, CalendarIcon, FileBarChart2, ReceiptText } from 'lucide-react';
import AdminDeliveriesReportDialog from './AdminDeliveriesReportDialog';
import AdminBulkBillsDialog from './AdminBulkBillsDialog';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { format } from 'date-fns';
import { fuzzySearch } from '@/lib/search-utils';
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

const DeliveryRequestList: React.FC<DeliveryRequestListProps> = memo(({ onInitiateNewRequest, onEditRequest, deliveryRequests, setDeliveryRequests }) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterStartOpen, setFilterStartOpen] = useState(false);
  const [filterEndOpen, setFilterEndOpen] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [filterDraft, setFilterDraft] = useState<{ start: string; end: string; cash: boolean; account: boolean; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; cancelled: boolean; pending: boolean; processing: boolean; customerCreated: boolean }>({ start: '', end: '', cash: false, account: false, cans: '', cansOp: '=', price: '', priceOp: '>', cancelled: false, pending: false, processing: false, customerCreated: false });
  const [activeFilter, setActiveFilter] = useState<{ start: string; end: string; cash: boolean; account: boolean; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; cancelled: boolean; pending: boolean; processing: boolean; customerCreated: boolean }>({ start: '', end: '', cash: false, account: false, cans: '', cansOp: '=', price: '', priceOp: '>', cancelled: false, pending: false, processing: false, customerCreated: false });
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isBulkBillsOpen, setIsBulkBillsOpen] = useState(false);
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [allCustomersList, setAllCustomersList] = useState<Customer[]>([]);
  const [isLoadingAllCustomers, setIsLoadingAllCustomers] = useState(false);
  
  // Loaded requests state (always shows first 100, filters fetch all records)
  const [loadedRequests, setLoadedRequests] = useState<DeliveryRequest[]>([]);
  
  // Unified search state (both requests and customers)
  const [searchResults, setSearchResults] = useState<{ requests: DeliveryRequest[]; customers: Customer[] }>({ requests: [], customers: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track initial load
  const isInitialLoadRef = useRef(true);
  // Track previous cancelled filter state to detect when it's turned off
  const prevCancelledFilterRef = useRef(false);
  // Track previous date filter state to detect when it's turned off
  const prevDateFilterRef = useRef<{ start: string; end: string } | null>(null);
  
  // Optimistically track customers with recently created requests (before deliveryRequests updates)
  const [recentlyCreatedCustomerIds, setRecentlyCreatedCustomerIds] = useState<Set<string>>(new Set());
  const prevDeliveryRequestsRef = useRef<DeliveryRequest[]>([]);

  // Customer cache with 24-hour expiration
  const CUSTOMER_CACHE_KEY = 'paani_customer_cache';
  const CUSTOMER_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  const getCachedCustomers = (): Customer[] | null => {
    try {
      const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid (within 24 hours)
      if (now - timestamp < CUSTOMER_CACHE_EXPIRY) {
        console.log('✅ Using cached customers (age:', Math.round((now - timestamp) / 1000 / 60), 'minutes)');
        return data;
      } else {
        console.log('⏰ Customer cache expired, will refresh');
        localStorage.removeItem(CUSTOMER_CACHE_KEY);
        return null;
      }
    } catch (error) {
      console.error('Error reading customer cache:', error);
      return null;
    }
  };

  const setCachedCustomers = (customers: Customer[]) => {
    try {
      const cacheData = {
        data: customers,
        timestamp: Date.now()
      };
      localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(cacheData));
      console.log('💾 Cached', customers.length, 'customers for 24 hours');
    } catch (error) {
      console.error('Error caching customers:', error);
    }
  };
  
  // Immediately exclude customers when new requests appear in deliveryRequests
  useEffect(() => {
    const prevIds = new Set(prevDeliveryRequestsRef.current.map(r => r._id || r.requestId));
    const currentIds = new Set(deliveryRequests.map(r => r._id || r.requestId));
    
    // Find newly added requests
    const newRequests = deliveryRequests.filter(r => {
      const id = r._id || r.requestId;
      return !prevIds.has(id) && ['pending', 'pending_confirmation', 'processing'].includes(r.status);
    });
    
    // Add their customer IDs to exclusion set immediately
    if (newRequests.length > 0) {
      setRecentlyCreatedCustomerIds(prev => {
        const next = new Set(prev);
        newRequests.forEach(req => {
          const raw = (req as any).customerId;
          const normalized = raw && typeof raw === 'object'
            ? String(raw._id ?? raw.id ?? '')
            : String(raw ?? '');
          if (normalized) {
            next.add(normalized);
          }
        });
        return next;
      });
    }
    
    // Clean up: remove customer IDs that now have active requests in deliveryRequests
    const activeCustomerIds = new Set(
      deliveryRequests
        .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
        .map(req => {
          const raw = (req as any).customerId;
          return raw && typeof raw === 'object'
            ? String(raw._id ?? raw.id ?? '')
            : String(raw ?? '');
        })
    );
    
    setRecentlyCreatedCustomerIds(prev => {
      const next = new Set(prev);
      // Remove IDs that are now in activeCustomerIds (they're properly tracked)
      activeCustomerIds.forEach(id => next.delete(id));
      return next;
    });
    
    prevDeliveryRequestsRef.current = [...deliveryRequests];
  }, [deliveryRequests]);

  // Initial load only: Set loadedRequests from deliveryRequests prop ONCE (100 most recent by creation time)
  useEffect(() => {
    if (deliveryRequests.length > 0 && loadedRequests.length === 0 && isInitialLoadRef.current) {
      // Sort by requestedAt (newest first) to get the 100 most recent by creation time
      const sortedByDate = [...deliveryRequests].sort((a, b) => {
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA; // Newest first
      });
      
      // Always keep only first 100 most recent records by creation time
      const first100 = sortedByDate.slice(0, 100);
      setLoadedRequests(first100);
      isInitialLoadRef.current = false;
      console.log('📦 Initial load - Records:', first100.length, '(showing 100 most recent by creation time, use filters to see more)');
    }
  }, [deliveryRequests.length]);

  // Merge new/updated records from deliveryRequests prop (after initial load)
  // This handles real-time updates without resetting paginated data
  useEffect(() => {
    // Skip if initial load hasn't happened yet, or if cancelled/date filter is active
    const hasDateFilter = activeFilter.start || activeFilter.end;
    if (isInitialLoadRef.current || activeFilter.cancelled || activeFilter.pending || activeFilter.processing || activeFilter.customerCreated || hasDateFilter) {
      return;
    }

    // Only process if we have loadedRequests (pagination has started)
    // If loadedRequests is empty but deliveryRequests has data, let initial load handle it
    if (loadedRequests.length === 0) {
      return;
    }

    // Create a map of existing loaded requests for quick lookup
    const existingMap = new Map(loadedRequests.map(r => [(r._id || r.requestId), r]));
    
    // Find new records (in deliveryRequests but not in loadedRequests)
    const newRecords = deliveryRequests.filter(r => {
      const id = r._id || r.requestId;
      return !existingMap.has(id);
    });

    // Find updated records (same ID but different data)
    const updatedRecords: DeliveryRequest[] = [];
    deliveryRequests.forEach(r => {
      const id = r._id || r.requestId;
      const existing = existingMap.get(id);
      if (existing) {
        // Simple check: compare key fields that might change
        const existingStr = JSON.stringify({
          status: existing.status,
          cans: existing.cans,
          requestedAt: existing.requestedAt,
          address: existing.address
        });
        const newStr = JSON.stringify({
          status: r.status,
          cans: r.cans,
          requestedAt: r.requestedAt,
          address: r.address
        });
        if (existingStr !== newStr) {
          updatedRecords.push(r);
        }
      }
    });

    if (newRecords.length > 0 || updatedRecords.length > 0) {
      console.log('📦 Merging real-time updates:', { new: newRecords.length, updated: updatedRecords.length, totalLoaded: loadedRequests.length });
      
      setLoadedRequests(prev => {
        // Create a new map from previous requests
        const updatedMap = new Map(prev.map(r => [(r._id || r.requestId), r]));
        
        // Update existing records
        updatedRecords.forEach(updated => {
          const id = updated._id || updated.requestId;
          updatedMap.set(id, updated);
        });
        
        // Add new records (they'll be at the beginning after sorting)
        newRecords.forEach(newRecord => {
          const id = newRecord._id || newRecord.requestId;
          updatedMap.set(id, newRecord);
        });
        
        // Convert back to array, maintaining order: new records first, then existing
        // Preserve the original order for existing records
        const existingArray = prev.filter(r => {
          const id = r._id || r.requestId;
          return !newRecords.some(nr => (nr._id || nr.requestId) === id);
        }).map(r => {
          const id = r._id || r.requestId;
          return updatedMap.get(id) || r;
        });
        
        // Combine: new records first, then existing records
        const combined = [...newRecords, ...existingArray];
        
        // Sort by requestedAt (newest first) to get the 100 most recent by creation time
        const sortedByDate = combined.sort((a, b) => {
          const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
          const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
          return timeB - timeA; // Newest first
        });
        
        // Always maintain only 100 most recent records by creation time (stack behavior)
        // New entries at top, oldest entries removed if exceeding 100
        const limited = sortedByDate.slice(0, 100);
        
        if (sortedByDate.length > 100) {
          const removedCount = sortedByDate.length - 100;
          const oldestRemoved = sortedByDate.slice(100).map(r => {
            const id = (r as any).customerIntId || (r as any).id || r._id || r.requestId || 'unknown';
            const date = r.requestedAt ? new Date(r.requestedAt).toISOString() : 'no date';
            return `${id} (${date})`;
          }).slice(0, 5);
          const keptOldest = limited[limited.length - 1];
          const keptOldestId = (keptOldest as any)?.customerIntId || (keptOldest as any)?.id || keptOldest?._id || keptOldest?.requestId || 'unknown';
          const keptOldestDate = keptOldest?.requestedAt ? new Date(keptOldest.requestedAt).toISOString() : 'no date';
          console.log(`📦 Maintained 100 most recent records:`);
          console.log(`   - Removed ${removedCount} oldest:`, oldestRemoved);
          console.log(`   - Oldest kept: ${keptOldestId} (${keptOldestDate})`);
        }
        
        return limited;
      });
    }
  }, [deliveryRequests, activeFilter.cancelled, activeFilter.start, activeFilter.end]);
  
  // Unified search: both customers and delivery requests
  // Customers are searched from cache, delivery requests from database
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedSearch = searchTerm.trim();
    
    // If search is empty, clear search results and show normal data
    if (!trimmedSearch) {
      setSearchResults({ requests: [], customers: [] });
      setIsSearching(false);
      return;
    }

    // Debounce search - wait 500ms after user stops typing
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Search delivery requests from database (keep same as before)
        const requestsResponse = await fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=10000&search=${encodeURIComponent(trimmedSearch)}`));
        
        const requestsResult = requestsResponse.ok ? await requestsResponse.json() : null;
        const requestsData = requestsResult 
          ? (Array.isArray(requestsResult) ? requestsResult : (requestsResult?.data || []))
          : [];
        
        // Search customers from cache (allCustomers state) instead of database
        // This is much faster and doesn't hit the database
        const isNumericSearch = /^\d+$/.test(trimmedSearch);
        const searchLower = trimmedSearch.toLowerCase();
        
        const customersData = allCustomers.filter(customer => {
          if (isNumericSearch) {
            // For numeric search, only match customer ID
            return (customer as any).id && String((customer as any).id) === trimmedSearch;
          } else {
            // For text search, match name, address, or phone
            const matchesName = fuzzySearch(customer.name, searchLower);
            const matchesPhone = customer.phone ? fuzzySearch(customer.phone, searchLower) : false;
            const matchesAddress = fuzzySearch(customer.address, searchLower);
            return matchesName || matchesPhone || matchesAddress;
          }
        });
        
        // Store both results - we'll combine them in the display logic
        setSearchResults({ requests: requestsData, customers: customersData });
        setIsSearching(false);
        console.log(`🔍 Unified search found ${requestsData.length} requests (from DB) and ${customersData.length} customers (from cache) for: "${trimmedSearch}"`);
      } catch (error) {
        console.error('Error searching:', error);
        setSearchResults({ requests: [], customers: [] });
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, allCustomers]);

  // Fetch ALL records from backend when any status/customerCreated filter is active
  useEffect(() => {
    const { cancelled, pending, processing, customerCreated } = activeFilter;
    const hasStatusFilter = cancelled || pending || processing || customerCreated;

    if (hasStatusFilter) {
      const fetchStatusRequests = async () => {
        setIsLoading(true);
        try {
          const params: string[] = ['page=1', 'limit=10000'];
          if (pending) { params.push('status=pending'); params.push('status=pending_confirmation'); }
          if (processing) params.push('status=processing');
          if (cancelled) params.push('status=cancelled');
          if (customerCreated) params.push('createdBy=customer_portal');

          const res = await fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?${params.join('&')}`));
          if (res.ok) {
            const result = await res.json();
            const data = Array.isArray(result) ? result : (result?.data || []);
            setLoadedRequests(data);
          }
        } catch (err) {
          console.error('Error fetching filtered requests:', err);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch requests.' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchStatusRequests();
      prevCancelledFilterRef.current = true;
    } else if (prevCancelledFilterRef.current) {
      // All filters turned OFF — reset to normal top-100
      const sortedByDate = [...deliveryRequests].sort((a, b) => {
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA;
      });
      setLoadedRequests(sortedByDate.slice(0, 100));
      prevCancelledFilterRef.current = false;
    }
  }, [activeFilter.cancelled, activeFilter.pending, activeFilter.processing, activeFilter.customerCreated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ALL records for selected date range from backend when date filter is active (NO PAGINATION)
  useEffect(() => {
    const hasDateFilter = activeFilter.start || activeFilter.end;
    const currentDateFilter = hasDateFilter ? { start: activeFilter.start, end: activeFilter.end } : null;
    
    if (hasDateFilter) {
      const fetchAllDateFilteredRequests = async () => {
        setIsLoading(true);
        try {
          // Calculate date range
          let startDate: Date;
          let endDate: Date;
          
          if (activeFilter.start && activeFilter.end) {
            // Both start and end dates provided
            startDate = new Date(activeFilter.start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(activeFilter.end);
            endDate.setHours(23, 59, 59, 999);
            // Backend uses $lt, so we need to add 1 day to endDate to make it inclusive
            endDate.setDate(endDate.getDate() + 1);
          } else if (activeFilter.start) {
            // Only start date provided - from start date to today
            startDate = new Date(activeFilter.start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            endDate.setDate(endDate.getDate() + 1); // Start of next day (exclusive)
          } else if (activeFilter.end) {
            // Only end date provided - from beginning to end date
            startDate = new Date(0); // Beginning of time
            endDate = new Date(activeFilter.end);
            endDate.setHours(23, 59, 59, 999);
            endDate.setDate(endDate.getDate() + 1); // Start of next day (exclusive)
          } else {
            return; // Should not happen, but safety check
          }
          
          // Format dates for API (ISO string)
          const startDateStr = startDate.toISOString();
          const endDateStr = endDate.toISOString();
          
          // Fetch all records for this date range with a very high limit (no pagination)
          const res = await fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=10000&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`));
          if (res.ok) {
            const result = await res.json();
            const data = Array.isArray(result) ? result : (result?.data || []);
            
            // Set all date-filtered requests
            setLoadedRequests(data);
            console.log('📦 Loaded ALL date-filtered requests:', data.length, 'for date range:', activeFilter.start || 'beginning', 'to', activeFilter.end || 'today');
          }
        } catch (err) {
          console.error('Error fetching date-filtered requests:', err);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to fetch date-filtered requests.'
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchAllDateFilteredRequests();
      prevDateFilterRef.current = currentDateFilter;
    } else if (prevDateFilterRef.current) {
      // Date filter was just turned OFF - reset to normal data (100 most recent by creation time)
      console.log('📦 Date filter turned off - resetting to normal data');
      const sortedByDate = [...deliveryRequests].sort((a, b) => {
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA; // Newest first
      });
      const first100 = sortedByDate.slice(0, 100);
      setLoadedRequests(first100);
      prevDateFilterRef.current = null;
    }
    // This prevents real-time updates from interfering with the date filter
  }, [activeFilter.start, activeFilter.end]); // Removed deliveryRequests dependency to prevent reset on real-time updates
  
  // Reset pagination when other filters change (status filters handled by their own useEffect above)
  useEffect(() => {
    const hasStatusFilter = activeFilter.cancelled || activeFilter.pending || activeFilter.processing;
    if (!hasStatusFilter && loadedRequests.length > 100) {
      const sortedByDate = [...deliveryRequests].sort((a, b) => {
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA;
      });
      setLoadedRequests(sortedByDate.slice(0, 100));
    }
  }, [activeFilter.start, activeFilter.end, activeFilter.cash, activeFilter.account, activeFilter.cans, activeFilter.price, activeFilter.cancelled, activeFilter.pending, activeFilter.processing]);

  // Cancellation state
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<DeliveryRequest | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('door_closed');
  const [cancellationNotes, setCancellationNotes] = useState<string>('');

  useEffect(() => {
    // On page refresh/reload, always fetch fresh customers from database
    // This ensures newly added customers are immediately available
    setIsLoadingCustomers(true);
    
    // Use cached customers as fallback for immediate display while fetching
    const cachedCustomers = getCachedCustomers();
    if (cachedCustomers) {
      setAllCustomers(cachedCustomers);
      console.log('⚡ Using cached customers temporarily while fetching fresh data...');
    }
    
    // Always fetch fresh data from database on page load
    fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=10000`))
      .then(res => res.json())
      .then((result) => {
        const data = Array.isArray(result) ? result : (result?.data || []);
        setAllCustomers(data);
        setCachedCustomers(data); // Update cache with fresh data
        setIsLoadingCustomers(false);
        setError(null);
        console.log('✅ Fetched fresh', data.length, 'customers from database and updated cache');
      })
      .catch((err) => {
        // If fetch fails, keep using cached data if available
        if (cachedCustomers) {
          console.warn('⚠️ Failed to fetch fresh customers, using cached data');
          setError(null);
        } else {
          setError('Failed to fetch customers.');
        }
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
  const startDateRef = useMemo(() => {
    if (!activeFilter.start) return null;
    const start = new Date(activeFilter.start);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [activeFilter.start]);

  const endDateRef = useMemo(() => {
    if (!activeFilter.end) return null;
    const end = new Date(activeFilter.end);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [activeFilter.end]);

  // No pagination - removed fetchDeliveryRequests and loadMoreDeliveryRequests
  // Main page shows first 100 records, filters fetch all records when needed
  
  // Apply panel filters after search filtering - optimized version
  // Process requests to include customerIntId and sort
  const processedRequests = useMemo(() => {
    const requestsToProcess = loadedRequests.length > 0 ? loadedRequests : deliveryRequests;
    if (!requestsToProcess.length) return [];
    
    const processed = [...requestsToProcess].map(req => ({
      ...req,
      customerIntId: (req as any).customerIntId || (req as any).id || null
    })).sort((a, b) => {
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
    
    return processed;
  }, [loadedRequests, deliveryRequests, getStatusOrderValue]);

  // Use backend search results if search term exists, otherwise use processed requests
  const filteredDeliveryRequests = useMemo(() => {
    const trimmed = searchTerm.trim();
    
    // If searching, use backend search results (requests only)
    if (trimmed) {
      // Process search results the same way as normal requests
      return searchResults.requests.map(req => ({
        ...req,
        customerIntId: (req as any).customerId && typeof (req as any).customerId === 'object' 
          ? ((req as any).customerId as any).id || 0 
          : 0
      }));
    }
    
    // No search - return processed requests
    return processedRequests;
  }, [searchTerm, searchResults, processedRequests]);

  // Use loadedRequests for filtering instead of deliveryRequests prop
  // NOTE: Date filtering is now handled by backend fetch, so we don't need to filter here
  const fullyFilteredRequests = useMemo(() => {
    const list = filteredDeliveryRequests;
    const { start, end, cash, account, cans, cansOp, price, priceOp, cancelled, pending, processing, customerCreated } = activeFilter;

    // Early return if no filters are active (date filter is handled by backend fetch)
    const hasDateFilter = start || end;
    const hasPaymentFilter = cash || account;
    const cansFilterVal = cans && /^\d{1,2}$/.test(cans) ? Number(cans) : null;
    const priceFilterVal = price && /^\d{1,3}$/.test(price) ? Number(price) : null;
    const hasStatusFilter = cancelled || pending || processing;

    // If only date filter is active, return list as-is (already filtered by backend)
    if (hasDateFilter && !hasPaymentFilter && cansFilterVal == null && priceFilterVal == null && !hasStatusFilter && !customerCreated) {
      return list;
    }

    // If no filters are active, return list
    if (!hasDateFilter && !hasPaymentFilter && cansFilterVal == null && priceFilterVal == null && !hasStatusFilter && !customerCreated) {
      return list;
    }

    // Apply other filters (date filter already applied by backend)
    return list.filter(req => {
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

      // Status filters — any checked status is shown
      if (hasStatusFilter) {
        const s = req.status;
        const matchesCancelled = cancelled && s === 'cancelled';
        const matchesPending = pending && (s === 'pending' || s === 'pending_confirmation');
        const matchesProcessing = processing && s === 'processing';
        if (!matchesCancelled && !matchesPending && !matchesProcessing) return false;
      }

      // Customer created filter
      if (customerCreated && (req as any).createdBy !== 'customer_portal') return false;

      return true;
    });
  }, [filteredDeliveryRequests, activeFilter, startDateRef, endDateRef]);

  // Separate optimized address sorting
  const sortedRequests = useMemo(() => {
    if (!addressSortOrder) {
      return fullyFilteredRequests;
    }
    
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

  // Unified grouped results: customers with their delivery requests
  const unifiedSearchResults = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return [];

    // Get all customers from search (both from searchResults and allCustomers for fuzzy matching)
    const searchLower = trimmed.toLowerCase();
    const allSearchedCustomers = new Map<string, Customer>();
    
    // Add customers from backend search
    searchResults.customers.forEach(customer => {
      const rawCust = (customer as any)._id || (customer as any).customerId;
      const normalizedCust = rawCust && typeof rawCust === 'object'
        ? String(rawCust._id ?? rawCust.id ?? '')
        : String(rawCust ?? '');
      if (normalizedCust) {
        allSearchedCustomers.set(normalizedCust, customer);
      }
    });

    // Also search in allCustomers for fuzzy matching
    // For numeric search, ONLY match customer ID, not phone numbers
    const isNumericSearch = /^\d+$/.test(trimmed);
    allCustomers.forEach(customer => {
      let matchesName = false;
      let matchesPhone = false;
      let matchesAddress = false;
      const matchesId = (customer as any).id && String((customer as any).id) === trimmed;
      
      // Only do fuzzy search for non-numeric terms
      if (!isNumericSearch) {
        matchesName = fuzzySearch(customer.name, searchLower);
        matchesPhone = customer.phone ? fuzzySearch(customer.phone, searchLower) : false;
        matchesAddress = fuzzySearch(customer.address, searchLower);
      }
      
      if (matchesName || matchesPhone || matchesAddress || matchesId) {
        const rawCust = (customer as any)._id || (customer as any).customerId;
        const normalizedCust = rawCust && typeof rawCust === 'object'
          ? String(rawCust._id ?? rawCust.id ?? '')
          : String(rawCust ?? '');
        if (normalizedCust && !allSearchedCustomers.has(normalizedCust)) {
          allSearchedCustomers.set(normalizedCust, customer);
        }
      }
    });

    // Group delivery requests by customer
    const requestsByCustomer = new Map<string, DeliveryRequest[]>();
    searchResults.requests.forEach(req => {
      const raw = (req as any).customerId;
      const normalized = raw && typeof raw === 'object'
        ? String(raw._id ?? raw.id ?? '')
        : String(raw ?? '');
      if (normalized) {
        if (!requestsByCustomer.has(normalized)) {
          requestsByCustomer.set(normalized, []);
        }
        requestsByCustomer.get(normalized)!.push(req);
      }
    });

    // Also check deliveryRequests prop for customers that might have requests
    deliveryRequests.forEach(req => {
      const raw = (req as any).customerId;
      const normalized = raw && typeof raw === 'object'
        ? String(raw._id ?? raw.id ?? '')
        : String(raw ?? '');
      if (normalized && allSearchedCustomers.has(normalized)) {
        if (!requestsByCustomer.has(normalized)) {
          requestsByCustomer.set(normalized, []);
        }
        // Only add if not already in the list
        const existing = requestsByCustomer.get(normalized)!;
        const reqId = req._id || req.requestId;
        if (!existing.some(r => (r._id || r.requestId) === reqId)) {
          existing.push(req);
        }
      }
    });

    // Create unified structure: array of { customer, requests }
    const result: Array<{ customer: Customer; requests: DeliveryRequest[] }> = [];
    
    allSearchedCustomers.forEach((customer, customerId) => {
      const requests = requestsByCustomer.get(customerId) || [];
      
      // Sort requests: active first, then by date (newest first)
      const sortedRequests = [...requests].sort((a, b) => {
        const aIsActive = ['pending', 'pending_confirmation', 'processing'].includes(a.status);
        const bIsActive = ['pending', 'pending_confirmation', 'processing'].includes(b.status);
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        // Both active or both inactive - sort by date (newest first)
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA;
      });
      
      result.push({ customer, requests: sortedRequests });
    });

    // Sort results by customer name
    return result.sort((a, b) => {
      const nameA = a.customer.name.toLowerCase();
      const nameB = b.customer.name.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [searchTerm, searchResults, allCustomers, deliveryRequests]);
  

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
      // For ID search, show customer even if they have active requests
      // (we'll conditionally show create request button in UI based on active requests)
      return allCustomers.filter(c => (c as any).id === idNum);
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
    // Also exclude recently created customers
    const allExcludedIds = new Set([...customersWithActiveRequests, ...recentlyCreatedCustomerIds]);

    // For numeric search, ONLY match customer ID, not phone numbers
    const isNumericSearch = /^\d+$/.test(trimmed);
    
    return allCustomers
      .filter(customer => {
        let matchesName = false;
        let matchesPhone = false;
        let matchesAddress = false;
        
        // Only do fuzzy search for non-numeric terms
        if (!isNumericSearch) {
          matchesName = fuzzySearch(customer.name, searchLower);
          matchesPhone = customer.phone ? fuzzySearch(customer.phone, searchLower) : false;
          matchesAddress = fuzzySearch(customer.address, searchLower);
        }
        const rawCust = (customer as any)._id || (customer as any).customerId;
        const normalizedCust = rawCust && typeof rawCust === 'object'
          ? String(rawCust._id ?? rawCust.id ?? '')
          : String(rawCust ?? '');
        const hasNoActiveRequest = !allExcludedIds.has(normalizedCust || '');
        return (matchesName || matchesPhone || matchesAddress) && hasNoActiveRequest;
      });
  }, [allCustomers, deliveryRequests, searchTerm, recentlyCreatedCustomerIds]);

  const handleCreateRequest = (customer: Customer) => {
    onInitiateNewRequest(customer);
    // Keep search term and cursor; do not clear automatically
  };

  const fetchAllCustomers = async () => {
    if (allCustomersList.length > 0) {
      // Already loaded, just toggle display
      setShowAllCustomers(!showAllCustomers);
      return;
    }

    setIsLoadingAllCustomers(true);
    setShowAllCustomers(true);
    try {
      // Check cache first
      const cachedCustomers = getCachedCustomers();
      
      if (cachedCustomers) {
        // Use cached customers
        const sorted = [...cachedCustomers].sort((a, b) => {
          const aId = (a as any).id || 0;
          const bId = (b as any).id || 0;
          return aId - bId;
        });
        setAllCustomersList(sorted);
        console.log(`✅ Loaded all ${sorted.length} customers from cache (sorted by ID ascending)`);
        setIsLoadingAllCustomers(false);
        return;
      }

      // Cache expired or doesn't exist, fetch from database
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=10000`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      const data: Customer[] = Array.isArray(result) ? result : (result?.data || []);
      // Sort by ID ascending
      const sorted = [...data].sort((a, b) => {
        const aId = (a as any).id || 0;
        const bId = (b as any).id || 0;
        return aId - bId;
      });
      setAllCustomersList(sorted);
      setCachedCustomers(sorted); // Cache the fetched customers
      console.log(`✅ Fetched and cached all ${sorted.length} customers from database (sorted by ID ascending)`);
    } catch (error) {
      console.error('Error fetching all customers:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customers. Please try again.",
      });
      setShowAllCustomers(false);
    } finally {
      setIsLoadingAllCustomers(false);
    }
  };

  // Filter all customers to exclude those with active requests
  const availableCustomersForRequest = useMemo(() => {
    if (!showAllCustomers || allCustomersList.length === 0) return [];

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
    // Also exclude recently created customers
    const allExcludedIds = new Set([...customersWithActiveRequests, ...recentlyCreatedCustomerIds]);

    return allCustomersList.filter(customer => {
      const rawCust = (customer as any)._id || (customer as any).customerId;
      const normalizedCust = rawCust && typeof rawCust === 'object'
        ? String(rawCust._id ?? rawCust.id ?? '')
        : String(rawCust ?? '');
      return !allExcludedIds.has(normalizedCust || '');
    });
  }, [showAllCustomers, allCustomersList, deliveryRequests, recentlyCreatedCustomerIds]);

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
      case 'processing': return 'default';
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

  const formatDuration = (ms: number): string => {
    if (ms <= 0) return '—';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  };

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
    <div className="space-y-6 w-full">
      <div className="relative mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
        {searchTerm ? (
          <X 
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-destructive cursor-pointer hover:text-destructive/80" 
            onClick={() => setSearchTerm('')}
          />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}
        <Input
          type="search"
              placeholder="Search all records by customer name, address, phone, or ID..."
          value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === '\\') {
                  e.preventDefault();
                  setSearchTerm('');
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className={`pl-10 w-full ${isSearching ? 'opacity-70' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportDialogOpen(true)}
              title="Deliveries Report"
              className="px-2 md:px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <FileBarChart2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Report</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkBillsOpen(true)}
              title="Bulk Bills"
              className="px-2 md:px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <ReceiptText className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Bulk Bills</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={fetchAllCustomers}
              disabled={isLoadingAllCustomers}
              title={isLoadingAllCustomers ? 'Loading...' : showAllCustomers ? 'Hide All Customers' : 'All Customers'}
              className="px-2 md:px-3"
            >
              <PlusCircle className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">
                {isLoadingAllCustomers ? 'Loading...' : showAllCustomers ? 'Hide All Customers' : 'All Customers'}
              </span>
            </Button>
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Filters">
                  <ListFilter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-2 block">From</Label>
                    <Popover open={filterStartOpen} onOpenChange={setFilterStartOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal text-sm h-9", !filterDraft.start && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          {filterDraft.start ? format(new Date(filterDraft.start), "MMM d, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDraft.start ? new Date(filterDraft.start) : undefined}
                          onSelect={(date) => {
                            setFilterDraft(prev => ({
                              ...prev,
                              start: date ? format(date, 'yyyy-MM-dd') : '',
                              end: prev.end || (date ? todayStr : ''),
                            }));
                            setFilterStartOpen(false);
                          }}
                          initialFocus
                        />
                        {filterDraft.start && (
                          <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterDraft(prev => ({ ...prev, start: '' })); setFilterStartOpen(false); }}>Clear</Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="mb-2 block">To</Label>
                    <Popover open={filterEndOpen} onOpenChange={setFilterEndOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal text-sm h-9", !filterDraft.end && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          {filterDraft.end ? format(new Date(filterDraft.end), "MMM d, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDraft.end ? new Date(filterDraft.end) : undefined}
                          onSelect={(date) => {
                            setFilterDraft(prev => ({ ...prev, end: date ? format(date, 'yyyy-MM-dd') : '' }));
                            setFilterEndOpen(false);
                          }}
                          initialFocus
                        />
                        {filterDraft.end && (
                          <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterDraft(prev => ({ ...prev, end: '' })); setFilterEndOpen(false); }}>Clear</Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
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
                <div className="flex flex-col gap-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="flt-pending" checked={filterDraft.pending} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, pending: !!v, processing: false, cancelled: false }))} />
                    <Label htmlFor="flt-pending">Only Show Pending</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="flt-processing" checked={filterDraft.processing} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, processing: !!v, pending: false, cancelled: false }))} />
                    <Label htmlFor="flt-processing">Only Show Processing</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="flt-cancelled" checked={filterDraft.cancelled} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, cancelled: !!v, pending: false, processing: false }))} />
                    <Label htmlFor="flt-cancelled">Only Show Cancelled</Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="flt-customer-created" checked={filterDraft.customerCreated} onCheckedChange={(v) => setFilterDraft(prev => ({ ...prev, customerCreated: !!v }))} />
                  <Label htmlFor="flt-customer-created">Customer Created</Label>
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
                  <Button variant="outline" onClick={() => {
                    const clearedFilter = { start: '', end: '', cash: false, account: false, cans: '', cansOp: '=' as const, price: '', priceOp: '>' as const, cancelled: false, pending: false, processing: false, customerCreated: false };
                    setFilterDraft(clearedFilter);
                    setActiveFilter(clearedFilter);
                    setIsFilterOpen(false);
                    // Reset to initial data when filters are cleared (100 most recent by creation time)
                    const sortedByDate = [...deliveryRequests].sort((a, b) => {
                      const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
                      const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
                      return timeB - timeA; // Newest first
                    });
                    const first100 = sortedByDate.slice(0, 100);
                    setLoadedRequests(first100);
                    // Trigger refresh from parent component
                    fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?page=1&limit=100`))
                      .then(res => res.json())
                      .then(result => {
                        const data = Array.isArray(result) ? result : (result?.data || []);
                        setDeliveryRequests(data);
                      })
                      .catch(err => console.error('Error refreshing delivery requests:', err));
                  }}>Clear</Button>
                  <Button onClick={() => { setActiveFilter(filterDraft); setIsFilterOpen(false); }}>Apply</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </div>
        </div>
      </div>

      {/* All Customers List for Manual Request Creation */}
      {showAllCustomers && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold">
              All Customers ({availableCustomersForRequest.length} available)
            </h4>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAllCustomers(false)}
            >
              Close
            </Button>
          </div>
          {isLoadingAllCustomers ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading all customers...</p>
              </div>
            </div>
          ) : availableCustomersForRequest.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">All customers have active requests.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                {availableCustomersForRequest.map(customer => {
                  const isSindhiName = /[ء-ي]/.test(customer.name);
                  const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                  
                  return (
                    <Card key={customer._id || customer.customerId || `customer-${Math.random()}`} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex flex-col">
                        <div className="flex-1">
                          <p className={cn("font-medium mb-1", nameClasses)}>
                            {(customer as any).id ? `${(customer as any).id} - ${customer.name}` : customer.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{customer.address}</p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            handleCreateRequest(customer);
                            // Keep list open so admin can create multiple requests without reopening
                          }}
                          className="mt-3 w-full"
                        >
                          <PlusCircle className="mr-2 h-4 w-4" /> Create Request
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unified Search Results: Customers with their delivery request history */}
      {searchTerm && (
        <>
          {isSearching && (
            <p className="text-muted-foreground mt-4 text-center">🔍 Searching all records...</p>
          )}
          {!isSearching && unifiedSearchResults.length === 0 && (
            <p className="text-muted-foreground mt-4 text-center">No customers or requests found matching "{searchTerm}".</p>
          )}
          {!isSearching && unifiedSearchResults.length > 0 && (
            <div className="space-y-6 mb-6">
              {/* First: All customers with "Create Request" button (no active requests) - Grid Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {unifiedSearchResults
                  .filter(({ customer, requests }) => {
                    const hasActiveRequest = requests.some(req => 
                      ['pending', 'pending_confirmation', 'processing'].includes(req.status)
                    );
                    return !hasActiveRequest;
                  })
                  .map(({ customer }) => {
                    const rawCust = (customer as any)._id || (customer as any).customerId;
                    const normalizedCust = rawCust && typeof rawCust === 'object'
                      ? String(rawCust._id ?? rawCust.id ?? '')
                      : String(rawCust ?? '');
                    
                    const isSindhiName = /[ء-ي]/.test(customer.name);
                    const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');

                    return (
                      <Card key={normalizedCust || customer._id || customer.customerId || `customer-create-${Math.random()}`} className="shadow-md border-2">
                        <CardContent className="p-4 flex flex-col">
                          <div className="flex-1">
                            <p className={cn("text-base font-semibold mb-1", nameClasses)}>
                              {(customer as any).id ? `${(customer as any).id} - ${customer.name}` : customer.name}
                            </p>
                            <p className="text-sm text-muted-foreground">{customer.address}</p>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleCreateRequest(customer)}
                            className="mt-3 w-full"
                          >
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Request
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>

              {/* Then: All delivery request histories grouped by customer */}
              {unifiedSearchResults
                .filter(({ requests }) => requests.length > 0)
                .map(({ customer, requests }) => {
                  const rawCust = (customer as any)._id || (customer as any).customerId;
                  const normalizedCust = rawCust && typeof rawCust === 'object'
                    ? String(rawCust._id ?? rawCust.id ?? '')
                    : String(rawCust ?? '');
                  
                  const isSindhiName = /[ء-ي]/.test(customer.name);
                  const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');

                  return (
                    <div key={normalizedCust || customer._id || customer.customerId || `customer-history-${Math.random()}`} className="space-y-3">
                      {/* Customer Card for History Section */}
                      <Card className="shadow-md border-2">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className={cn("text-lg font-semibold", nameClasses)}>
                                {(customer as any).id ? `${(customer as any).id} - ${customer.name}` : customer.name}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">{customer.address}</p>
                            </div>
                            <Badge variant="secondary" className="text-sm">
                              {requests.some(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status)) 
                                ? 'Active Request' 
                                : 'History'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Delivery Request History */}
                      <div className="ml-4 space-y-2">
                        {requests.map((request) => {
                          const isActive = ['pending', 'pending_confirmation', 'processing'].includes(request.status);
                          const isCancelled = request.status === 'cancelled';
                          const isDelivered = request.status === 'delivered';
                          const canEdit = request.status === 'pending' || request.status === 'processing';
                          const pricePerCan = (request as any).pricePerCan;
                          const paymentType = ((request as any).paymentType || '').toString();
                          const intId = (request as any).customerIntId;

                          return (
                            <Card 
                              key={request._id || request.requestId || `req-${Math.random()}`}
                              className={cn(
                                "shadow-sm",
                                isActive && "border-2 border-primary bg-primary/5",
                                isCancelled && "opacity-60 bg-muted/30",
                                isDelivered && "bg-green-500/10"
                              )}
                            >
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">ID: {intId || '-'}</span>
                                      <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize text-xs">
                                        {getStatusIcon(request.status)}
                                        {getStatusDisplay(request.status)}
                                      </Badge>
                                      {isActive && (
                                        <Badge variant="default" className="text-xs">
                                          {getPriorityIcon(request.priority)}
                                          {request.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Cans:</span> {request.cans}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Price:</span> {pricePerCan !== undefined ? `Rs. ${pricePerCan}` : '-'}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Payment:</span> {paymentType ? (
                                          <Badge variant="outline" className="capitalize ml-1 text-xs">{paymentType}</Badge>
                                        ) : '-'}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Requested:</span> {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, HH:mm') : '-'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    {canEdit && (
                                      <Button variant="ghost" size="icon" title="Edit Request" onClick={() => onEditRequest(request)}>
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                      </Button>
                                    )}
                                    {isActive && (
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
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* Normal table view when not searching */}
      {!searchTerm && fullyFilteredRequests.length === 0 && (
         <p className="text-muted-foreground mt-4 text-center">No delivery requests. Use search to find customers for new requests.</p>
      )}

      {!searchTerm && sortedRequests.length > 0 && (
        <>
        <div className="rounded-md border w-full">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%] text-center whitespace-nowrap">ID</TableHead>
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
                <TableHead className="w-[10%] text-center whitespace-nowrap">Edit / Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request, index) => {
                const isSindhiName = /[ء-ي]/.test(request.customerName);
                const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                const isCancelled = request.status === 'cancelled';
                const isDelivered = request.status === 'delivered';
                const canEdit = request.status === 'pending' || request.status === 'processing';
                const isCustomerCreated = (request as any).createdBy === 'customer_portal';
                const rowClasses = cn(
                    isCancelled ? 'opacity-60 bg-muted/30' : '',
                    isDelivered ? 'bg-green-500/10' : '',
                    request.status === 'processing' ? 'bg-yellow-100' : '',
                    isCustomerCreated ? 'border-l-4 border-l-blue-500' : ''
                );
                
                const pricePerCan = (request as any).pricePerCan;
                const paymentType = ((request as any).paymentType || '').toString();
                const intId = (request as any).customerIntId;

                return (
                  <TableRow key={request._id || request.requestId || `req-${Math.random()}`} className={rowClasses}>
                    <TableCell className={cn("w-[8%] text-center whitespace-nowrap font-medium", isCancelled && 'line-through')}>
                      {intId || '-'}
                    </TableCell>
                    <TableCell className={cn(nameClasses, isCancelled && 'line-through')}>
                        {request.customerName}
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
                      ) : isDelivered ? (
                        (() => {
                          const deliveredMs = (request as any).deliveredAt && request.requestedAt
                            ? new Date((request as any).deliveredAt).getTime() - new Date(request.requestedAt).getTime()
                            : 0;
                          const processingMs = (request as any).processingAt && request.requestedAt
                            ? new Date((request as any).processingAt).getTime() - new Date(request.requestedAt).getTime()
                            : 0;
                          return (
                            <div className="text-xs text-left inline-block">
                              <div className="font-bold">{deliveredMs > 0 ? formatDuration(deliveredMs) : '—'}</div>
                              {processingMs > 0 && (
                                <div className="text-muted-foreground text-[10px]">{formatDuration(processingMs)}</div>
                              )}
                            </div>
                          );
                        })()
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
        </>
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
                  <SelectItem value="not_needed_today">Not Needed Today</SelectItem>
                  <SelectItem value="ordered_by_mistake">Ordered by Mistake</SelectItem>
                  <SelectItem value="door_closed">Door Closed</SelectItem>
                  <SelectItem value="duplicate">Duplicate Order</SelectItem>
                  <SelectItem value="system_problem">System Problem</SelectItem>
                  <SelectItem value="area_not_reachable">Area Not Reachable</SelectItem>
                  <SelectItem value="bad_weather">Bad Weather</SelectItem>
                  <SelectItem value="no_stock_available">No Stock Available</SelectItem>
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

      <AdminDeliveriesReportDialog
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
      />
      <AdminBulkBillsDialog
        open={isBulkBillsOpen}
        onOpenChange={setIsBulkBillsOpen}
      />
    </div>
  );
});

export default DeliveryRequestList;


"use client";

import React, { useEffect, useState, useMemo, useImperativeHandle, forwardRef, memo, useRef } from 'react';
import type { Customer } from '@/types';
// REMOVE: import { db } from '@/firebase';
// REMOVE: import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Removed Avatar imports to save space
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Pencil, Star, ArrowUpAZ, ArrowDownAZ, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { Button } from '@/components/ui/button'; // Added Button
import { fuzzyMatch } from '@/lib/search-utils'; // PHASE 5: Use shared fuzzy search
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input as TextInput } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { ListFilter, CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomerListProps {
  onEditCustomer?: (customer: Customer) => void; // Optional for now, will be used by AdminDashboardPage
}

export interface CustomerListRef {
  refreshCustomers: () => void;
  updateCustomerInList: (customer: Customer) => void;
}

// PHASE 5: Memoized component to prevent unnecessary re-renders
const CustomerList = memo(forwardRef<CustomerListRef, CustomerListProps>(({ onEditCustomer }, ref) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  
  // Backend search state
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<{ start: string; end: string; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; ptCash: boolean; ptAccount: boolean }>({ start: '', end: '', cans: '', cansOp: '<', price: '', priceOp: '=', ptCash: false, ptAccount: false });
  const [activeFilter, setActiveFilter] = useState<{ start: string; end: string; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; ptCash: boolean; ptAccount: boolean }>({ start: '', end: '', cans: '', cansOp: '<', price: '', priceOp: '=', ptCash: false, ptAccount: false });
  const [customerCansMap, setCustomerCansMap] = useState<Record<string, number>>({});
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [idSortOrder, setIdSortOrder] = useState<'asc' | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [lastDeliveryMap, setLastDeliveryMap] = useState<Record<string, string>>({});
  const [inactiveSortCol, setInactiveSortCol] = useState<'name' | 'address' | 'price' | 'days'>('name');
  const [inactiveSortDir, setInactiveSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterStartOpen, setFilterStartOpen] = useState(false);
  const [filterEndOpen, setFilterEndOpen] = useState(false);
  
  const fetchCustomers = async (page: number = 1, append: boolean = false, retainScroll: boolean = false) => {
    const savedScrollY = retainScroll ? window.scrollY : 0;
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setCurrentPage(1);
    }
    try {
      const response = await fetch(`${buildApiUrl(API_ENDPOINTS.CUSTOMERS)}?page=${page}&limit=100`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // PHASE 4: Handle paginated response - extract data array if paginated
      const data: Customer[] = Array.isArray(result) ? result : (result?.data || []);
      const pagination = result.pagination || { hasNext: false, totalPages: 1 };
      
      console.log('👥 Fetched customers:', data.length, 'Page:', page, 'Has more:', pagination.hasNext, 'Limit requested: 100');
      
      // Ensure descending order by id (fallback createdAt)
      const sorted = [...data].sort((a, b) => {
        const aId = (a as any).id ?? 0;
        const bId = (b as any).id ?? 0;
        if (aId !== bId) return bId - aId;
        const aTime = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return bTime - aTime;
      });
      
      if (append) {
        // Append new data to existing list
        setAllCustomers(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(c => c._id || c.customerId));
          const newCustomers = sorted.filter(c => !existingIds.has(c._id || c.customerId));
          return [...prev, ...newCustomers];
        });
      } else {
      setAllCustomers(sorted);
      }
      
      // Update pagination state
      setCurrentPage(page);
      setHasMore(pagination.hasNext || false);
      setTotalPages(pagination.totalPages || 1);
      setError(null);

      // Fetch aggregated cans for current activeFilter (only on first load)
      if (!append) {
      await fetchAndBuildCansMap(activeFilter.start, activeFilter.end);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      if (retainScroll && savedScrollY > 0) {
        requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
      }
    }
  };

  const loadMoreCustomers = () => {
    if (!isLoadingMore && hasMore) {
      fetchCustomers(currentPage + 1, true);
    }
  };

  const fetchAndBuildCansMap = async (start?: string, end?: string) => {
    try {
      const url = new URL(buildApiUrl('api/customers/stats-summary'));
      if (start) url.searchParams.set('start', start);
      if (end) url.searchParams.set('end', end);
      console.log('Fetching customer stats from:', url.toString());
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn('Stats summary request failed:', res.status);
        return;
      }
      const json = await res.json();
      console.log('Stats summary response:', json);
      if (!json || !json.data) return;
      const map: Record<string, number> = {};
      for (const row of json.data) {
        map[row.customerObjectId] = row.totalCans;
      }
      console.log('Built customer cans map:', map);
      setCustomerCansMap(map);
    } catch (e) {
      console.warn('Failed to fetch stats summary:', e);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch last delivery dates when inactive checkbox is toggled on
  useEffect(() => {
    if (!showInactive) return;
    const fetchLastDeliveries = async () => {
      try {
        const res = await fetch(buildApiUrl('api/customers/last-delivery'));
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<string, string> = {};
        for (const row of json.data || []) {
          map[row.customerId] = row.lastDeliveryDate;
        }
        setLastDeliveryMap(map);
        // Also fetch ALL customers so we don't miss any inactive ones
        const allRes = await fetch(`${buildApiUrl(API_ENDPOINTS.CUSTOMERS)}?page=1&limit=10000`);
        if (allRes.ok) {
          const allResult = await allRes.json();
          const allData: Customer[] = Array.isArray(allResult) ? allResult : (allResult?.data || []);
          setAllCustomers(allData);
          setHasMore(false);
        }
      } catch (e) {
        console.warn('Failed to fetch last deliveries:', e);
      }
    };
    fetchLastDeliveries();
  }, [showInactive]);

  // When ascending filter is activated, fetch ALL customers (no pagination)
  useEffect(() => {
    if (idSortOrder === 'asc') {
      const fetchAllCustomers = async () => {
        setIsLoading(true);
        try {
          // Fetch all customers with a very high limit (or fetch all pages)
          const response = await fetch(`${buildApiUrl(API_ENDPOINTS.CUSTOMERS)}?page=1&limit=10000`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          const data: Customer[] = Array.isArray(result) ? result : (result?.data || []);
          
          // Sort by ID ascending (1, 2, 3, ...)
          const sorted = [...data].sort((a, b) => {
            const aId = (a as any).id || 0;
            const bId = (b as any).id || 0;
            return aId - bId;
          });
          
          setAllCustomers(sorted);
          setHasMore(false); // Disable pagination when ascending is active
          setCurrentPage(1);
          setError(null);
          console.log(`📊 Ascending filter: Loaded all ${sorted.length} customers sorted by ID`);
        } catch (err) {
          console.error('Error fetching all customers for ascending sort:', err);
          setError('Failed to fetch all customers.');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchAllCustomers();
    }
  }, [idSortOrder]);

  useImperativeHandle(ref, () => ({
    refreshCustomers: () => fetchCustomers(1, false, true),
    updateCustomerInList: (updated: Customer) => {
      setAllCustomers(prev =>
        prev.map(c =>
          (c._id && c._id === updated._id) || (c.customerId && c.customerId === updated.customerId)
            ? { ...c, ...updated }
            : c
        )
      );
    },
  }));

  // Backend search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedSearch = searchTerm.trim();
    
    // If search is empty, clear search results and show normal data
    if (!trimmedSearch) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce search - wait 500ms after user stops typing
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchUrl = buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=100&search=${encodeURIComponent(trimmedSearch)}`);
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        const data = Array.isArray(result) ? result : (result?.data || []);
        setSearchResults(data);
        setIsSearching(false);
        console.log(`🔍 Backend search found ${data.length} customers for: "${trimmedSearch}"`);
      } catch (error) {
        console.error('Error searching customers:', error);
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Use backend search results if search term exists, otherwise use all customers
  const filteredCustomers = useMemo(() => {
    const trimmed = searchTerm.trim();
    
    // If searching, use backend search results
    if (trimmed) {
      return searchResults;
    }
    
    // No search - return all customers
    return allCustomers;
  }, [searchTerm, searchResults, allCustomers]);

  // Apply filters to customers using aggregated cans and optional price
  const filteredAndAggregatedCustomers = useMemo(() => {
    const list = filteredCustomers; // name/phone/address fuzzy filter applied
    const { start, end, cans, cansOp, price, priceOp, ptCash, ptAccount } = activeFilter;
    const cansVal = cans && /^\d{1,6}$/.test(cans) ? Number(cans) : null;
    const priceVal = price && /^\d{1,3}$/.test(price) ? Number(price) : null;
    const hasCansFilter = cansVal != null && cansOp;
    const hasPriceFilter = priceVal != null;
    const hasPtFilter = ptCash || ptAccount;
    const hasDateFilter = start || end;

    console.log('Filter state:', { start, end, cans, cansOp, price, priceOp, ptCash, ptAccount });
    console.log('Filter booleans:', { hasCansFilter, hasPriceFilter, hasPtFilter, hasDateFilter });
    console.log('Customer cans map size:', Object.keys(customerCansMap).length);
    console.log('Customer cans map sample:', Object.entries(customerCansMap).slice(0, 3));

    if (!hasDateFilter && !hasCansFilter && !hasPriceFilter && !hasPtFilter && !addressSortOrder && !idSortOrder && !showInactive) {
      console.log('No filters active, returning all customers');
      return list;
    }

    const filtered = list.filter((c: Customer) => {
      // cans filter based on aggregated map
      if (hasCansFilter) {
        const customerId = c._id || (c as any).customerId || '';
        const total = customerCansMap[customerId] || 0;
        const op = cansOp || '=';
        console.log(`Filtering customer ${c.name} (ID: ${customerId}): total cans = ${total}, filter = ${op} ${cansVal}`);
        if (op === '<' && !(total < cansVal!)) {
          console.log(`  Rejected: ${total} is not < ${cansVal}`);
          return false;
        }
        if (op === '=' && !(total === cansVal!)) {
          console.log(`  Rejected: ${total} is not = ${cansVal}`);
          return false;
        }
        if (op === '>' && !(total > cansVal!)) {
          console.log(`  Rejected: ${total} is not > ${cansVal}`);
          return false;
        }
        console.log(`  Accepted: ${total} ${op} ${cansVal}`);
      }
      // price filter (per-can price from customer)
      if (hasPriceFilter) {
        const p = c.pricePerCan || 0;
        const op = priceOp || '=';
        if (op === '<' && !(p < priceVal!)) return false;
        if (op === '=' && !(p === priceVal!)) return false;
        if (op === '>' && !(p > priceVal!)) return false;
      }
      // payment type filter
      if (hasPtFilter) {
        const pt = ((c as any).paymentType || '').toString().toLowerCase();
        if (ptCash && pt !== 'cash') return false;
        if (ptAccount && pt !== 'account') return false;
      }
      return true;
    });

    console.log(`Filtered ${list.length} customers down to ${filtered.length}`);
    
    // Sort by ID (ascending) if idSortOrder is active
    if (idSortOrder === 'asc') {
      return [...filtered].sort((a, b) => {
        const aId = (a as any).id || 0;
        const bId = (b as any).id || 0;
        return aId - bId; // Ascending: 1, 2, 3, ...
      });
    }
    
    // Sort by address if addressSortOrder is active
    if (addressSortOrder) {
    const dir = addressSortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aAddr = (a.address || '').toString().toLowerCase();
      const bAddr = (b.address || '').toString().toLowerCase();
      if (aAddr < bAddr) return -1 * dir;
      if (aAddr > bAddr) return 1 * dir;
      // tie-breaker by createdAt newest first to keep list stable
      const ta = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
      return tb - ta;
    });
    }
    
    // Inactive customers — show all, sorted by selected column
    if (showInactive) {
      const dir = inactiveSortDir === 'asc' ? 1 : -1;
      return [...allCustomers].sort((a, b) => {
        if (inactiveSortCol === 'name') {
          const aId = (a as any).id ?? 0;
          const bId = (b as any).id ?? 0;
          return (aId - bId) * dir;
        }
        if (inactiveSortCol === 'address') {
          const aA = (a.address || '').toString().toLowerCase();
          const bA = (b.address || '').toString().toLowerCase();
          return aA < bA ? -dir : aA > bA ? dir : 0;
        }
        if (inactiveSortCol === 'price') {
          return ((a.pricePerCan || 0) - (b.pricePerCan || 0)) * dir;
        }
        // days
        const now = Date.now();
        const getAge = (c: Customer) => {
          const lastDate = lastDeliveryMap[String(c._id || (c as any).customerId || '')];
          return lastDate ? now - new Date(lastDate).getTime() : Infinity;
        };
        return (getAge(a) - getAge(b)) * dir;
      });
    }

    return filtered;
  }, [filteredCustomers, activeFilter, customerCansMap, addressSortOrder, idSortOrder, showInactive, lastDeliveryMap, allCustomers, inactiveSortCol, inactiveSortDir]);

  const buildFilterDescription = () => {
    const parts: string[] = [];
    if (showInactive) parts.push('Deactivated Customers');
    if (searchTerm.trim()) parts.push(`Search: "${searchTerm.trim()}"`);
    if (activeFilter.ptCash) parts.push('Cash only');
    if (activeFilter.ptAccount) parts.push('Account only');
    if (idSortOrder === 'asc') parts.push('Sort: ID Ascending');
    if (addressSortOrder === 'asc') parts.push('Sort: Address A→Z');
    if (addressSortOrder === 'desc') parts.push('Sort: Address Z→A');
    if (inactiveSortCol !== 'name' || inactiveSortDir !== 'asc') {
      const colLabel = inactiveSortCol === 'address' ? 'Address' : inactiveSortCol === 'price' ? 'Price/Can' : inactiveSortCol === 'days' ? 'Days Inactive' : 'Name';
      if (showInactive) parts.push(`Sort: ${colLabel} ${inactiveSortDir === 'asc' ? '↑' : '↓'}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'All Customers';
  };

  const buildPdfDoc = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const lx = 14;

    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('The Paani™', lx, 18);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    doc.text('RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO', lx, 24);
    doc.text('TEL: 0333 786 0 444', lx, 29);
    doc.setTextColor(63, 81, 181);
    doc.textWithLink('www.paani.online', lx, 34, { url: 'https://www.paani.online' });

    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('CUSTOMERS REPORT', pageW - lx, 18, { align: 'right' });
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
    doc.text(`Filter: ${buildFilterDescription()}`, pageW - lx, 24, { align: 'right' });
    doc.text(`Total: ${filteredAndAggregatedCustomers.length} customers`, pageW - lx, 29, { align: 'right' });
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageW - lx, 34, { align: 'right' });

    doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, 38, pageW - lx, 38);

    // Landscape 269mm total
    const headRow = showInactive
      ? [
          { content: 'ID', styles: { halign: 'center' } },
          { content: 'Name', styles: { halign: 'left' } },
          { content: 'Phone', styles: { halign: 'left' } },
          { content: 'Address', styles: { halign: 'left' } },
          { content: 'Payment Type', styles: { halign: 'center' } },
          { content: 'Default Cans', styles: { halign: 'center' } },
          { content: 'Price / Can', styles: { halign: 'right' } },
          { content: 'Days Inactive', styles: { halign: 'center' } },
        ]
      : [
          { content: 'ID', styles: { halign: 'center' } },
          { content: 'Name', styles: { halign: 'left' } },
          { content: 'Phone', styles: { halign: 'left' } },
          { content: 'Address', styles: { halign: 'left' } },
          { content: 'Payment Type', styles: { halign: 'center' } },
          { content: 'Default Cans', styles: { halign: 'center' } },
          { content: 'Price / Can', styles: { halign: 'right' } },
        ];

    const bodyRows = filteredAndAggregatedCustomers.map((c) => {
      const cid = String(c._id || (c as any).customerId || '');
      const lastDate = lastDeliveryMap[cid];
      const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
      const base = [
        String((c as any).id || '-'),
        c.name,
        c.phone || '-',
        c.address,
        ((c as any).paymentType === 'account' ? 'Account' : 'Cash'),
        String(c.defaultCans),
        typeof c.pricePerCan === 'number' ? `Rs. ${c.pricePerCan}` : '-',
      ];
      if (showInactive) base.push(days === null ? 'Never' : `${days}d`);
      return base;
    });

    const colStyles = showInactive
      ? { 0: { cellWidth: 12, halign: 'center' as const }, 1: { cellWidth: 60, halign: 'left' as const }, 2: { cellWidth: 28, halign: 'left' as const }, 3: { cellWidth: 72, halign: 'left' as const }, 4: { cellWidth: 24, halign: 'center' as const }, 5: { cellWidth: 18, halign: 'center' as const }, 6: { cellWidth: 20, halign: 'right' as const }, 7: { cellWidth: 35, halign: 'center' as const } }
      : { 0: { cellWidth: 12, halign: 'center' as const }, 1: { cellWidth: 75, halign: 'left' as const }, 2: { cellWidth: 30, halign: 'left' as const }, 3: { cellWidth: 85, halign: 'left' as const }, 4: { cellWidth: 25, halign: 'center' as const }, 5: { cellWidth: 20, halign: 'center' as const }, 6: { cellWidth: 22, halign: 'right' as const } };

    autoTable(doc, {
      startY: 43,
      head: [headRow],
      body: bodyRows,
      headStyles: { fillColor: [63, 81, 181], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: colStyles,
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });

    const disclaimer = 'This is a system-generated report and does not require a signature.';
    doc.setFontSize(9.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
    const dw = doc.getTextWidth(disclaimer);
    doc.text(disclaimer, (pageW - dw) / 2, pageH - 6);

    return doc;
  };

  const handleExportPDF = async () => {
    const doc = await buildPdfDoc();
    doc.save(`ThePaani_Customers_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const header = [
      ['The Paani™ — Customers Report'],
      ['RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO'],
      ['TEL: 0333 786 0 444  |  www.paani.online'],
      [],
      [`Filter: ${buildFilterDescription()}`],
      [`Total: ${filteredAndAggregatedCustomers.length} customers`],
      [`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`],
      [],
      showInactive
        ? ['ID', 'Name', 'Phone', 'Address', 'Payment Type', 'Default Cans', 'Price / Can (Rs)', 'Days Inactive']
        : ['ID', 'Name', 'Phone', 'Address', 'Payment Type', 'Default Cans', 'Price / Can (Rs)'],
    ];
    const rows = filteredAndAggregatedCustomers.map((c) => {
      const cid = String(c._id || (c as any).customerId || '');
      const lastDate = lastDeliveryMap[cid];
      const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
      const base = [
        (c as any).id || '-',
        c.name,
        c.phone || '-',
        c.address,
        ((c as any).paymentType === 'account' ? 'Account' : 'Cash'),
        c.defaultCans,
        typeof c.pricePerCan === 'number' ? c.pricePerCan : '-',
      ];
      if (showInactive) base.push(days === null ? 'Never' : `${days}d`);
      return base;
    });
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
    ws['!cols'] = showInactive
      ? [{ wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
      : [{ wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `ThePaani_Customers_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleWhatsAppShare = async () => {
    const text =
      `*The Paani™ — Customers Report*\n\n` +
      `*Filter:* ${buildFilterDescription()}\n` +
      `*Total Customers:* ${filteredAndAggregatedCustomers.length}\n` +
      `*Generated:* ${format(new Date(), 'MMM d, yyyy HH:mm')}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const doc = await buildPdfDoc();
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `ThePaani_Customers_${format(new Date(), 'yyyy-MM-dd')}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({ files: [pdfFile], title: 'The Paani™ Customers Report' });
          return;
        }
      } catch { /* fall through */ }
      try { await navigator.share({ text }); return; } catch { /* fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-10 w-1/3" /> 
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-2 border rounded-md">
            <Skeleton className="h-10 w-10 rounded-full" />
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
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => fetchCustomers(1, false)} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search all customers by name, phone, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`max-w-sm ${isSearching ? 'opacity-70' : ''}`}
        />
        <label className="flex items-center gap-1.5 cursor-pointer select-none bg-orange-50 border border-orange-300 rounded-lg px-2.5 py-1.5 ml-1">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="w-3.5 h-3.5 accent-orange-500"
          />
          <span className="text-xs font-medium text-orange-700">Deactivated Customers</span>
        </label>
        <Button onClick={() => fetchCustomers(1, false)} variant="outline" size="sm">
          Refresh
        </Button>
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Filters">
              <ListFilter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[90vw] max-w-[90vw] md:w-96 md:max-w-md p-3 md:p-4 max-h-[85vh] overflow-y-auto">
            <div className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block text-xs md:text-sm">Start Date (optional)</Label>
                  <Popover open={filterStartOpen} onOpenChange={setFilterStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm h-9 md:h-10', !filterDraft.start && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {filterDraft.start ? format(new Date(filterDraft.start + 'T00:00:00'), 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDraft.start ? new Date(filterDraft.start + 'T00:00:00') : undefined}
                        onSelect={(date) => { setFilterDraft(prev => ({ ...prev, start: date ? format(date, 'yyyy-MM-dd') : '' })); setFilterStartOpen(false); }} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="mb-2 block text-xs md:text-sm">End Date (optional)</Label>
                  <Popover open={filterEndOpen} onOpenChange={setFilterEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm h-9 md:h-10', !filterDraft.end && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {filterDraft.end ? format(new Date(filterDraft.end + 'T00:00:00'), 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDraft.end ? new Date(filterDraft.end + 'T00:00:00') : undefined}
                        onSelect={(date) => { setFilterDraft(prev => ({ ...prev, end: date ? format(date, 'yyyy-MM-dd') : '' })); setFilterEndOpen(false); }} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block text-xs md:text-sm">Total Cans</Label>
                  <div className="flex gap-2">
                    <Select value={filterDraft.cansOp} onValueChange={(value: '<' | '=' | '>') => setFilterDraft(prev => ({ ...prev, cansOp: value }))}>
                      <SelectTrigger className="w-20 md:w-16 h-9 md:h-10 text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                      </SelectContent>
                    </Select>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={filterDraft.cans}
                      onChange={(e) => setFilterDraft(prev => ({ ...prev, cans: e.target.value }))}
                      className="flex-1 h-9 md:h-10 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-xs md:text-sm">Price per Can</Label>
                  <div className="flex gap-2">
                    <Select value={filterDraft.priceOp} onValueChange={(value: '<' | '=' | '>') => setFilterDraft(prev => ({ ...prev, priceOp: value }))}>
                      <SelectTrigger className="w-20 md:w-16 h-9 md:h-10 text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                      </SelectContent>
                    </Select>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={filterDraft.price}
                      onChange={(e) => setFilterDraft(prev => ({ ...prev, price: e.target.value }))}
                      className="flex-1 h-9 md:h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs md:text-sm font-medium">Payment Type</Label>
                <div className="flex gap-4 md:gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ptCash"
                      checked={filterDraft.ptCash}
                      onCheckedChange={(checked) => setFilterDraft(prev => ({ ...prev, ptCash: checked as boolean }))}
                    />
                    <Label htmlFor="ptCash" className="text-xs md:text-sm">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ptAccount"
                      checked={filterDraft.ptAccount}
                      onCheckedChange={(checked) => setFilterDraft(prev => ({ ...prev, ptAccount: checked as boolean }))}
                    />
                    <Label htmlFor="ptAccount" className="text-xs md:text-sm">Account</Label>
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-0">
                <div className="flex gap-2 w-full md:w-auto">
                  <Button
                    variant={addressSortOrder === 'asc' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddressSortOrder(prev => (prev === 'asc' ? null : 'asc'))}
                    title="Ascending"
                    className="flex-1 md:flex-initial h-9 md:h-8 text-xs md:text-sm"
                  >
                    <ArrowUpAZ className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Asc
                  </Button>
                  <Button
                    variant={addressSortOrder === 'desc' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddressSortOrder(prev => (prev === 'desc' ? null : 'desc'))}
                    title="Descending"
                    className="flex-1 md:flex-initial h-9 md:h-8 text-xs md:text-sm"
                  >
                    <ArrowDownAZ className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Desc
                  </Button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-0">
                <Button
                  variant={idSortOrder === 'asc' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIdSortOrder(prev => (prev === 'asc' ? null : 'asc'))}
                  title="Sort by ID (Ascending)"
                  className="w-full md:w-auto h-9 md:h-8 text-xs md:text-sm"
                >
                  Ascending
                </Button>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={async () => { 
                      // Clear all filters
                      const clearedFilter = { start: '', end: '', cans: '', cansOp: '<' as const, price: '', priceOp: '=' as const, ptCash: false, ptAccount: false };
                      setFilterDraft(clearedFilter);
                      setActiveFilter(clearedFilter);
                      setIdSortOrder(null); // Clear ascending filter
                      setAddressSortOrder(null); // Clear address sort
                      setCustomerCansMap({}); // Clear cans map
                      setIsFilterOpen(false);
                      
                      // Reset pagination and fetch original customers
                      setCurrentPage(1);
                      setHasMore(false);
                      await fetchCustomers(1, false); // Fetch original customers
                      console.log('✅ All filters cleared and page refreshed');
                    }}
                    className="flex-1 md:flex-initial h-9 md:h-8 text-xs md:text-sm"
                  >
                    Clear
                  </Button>
                  <Button 
                    onClick={async () => { 
                      console.log('Apply button clicked with filter:', filterDraft);
                      setActiveFilter(filterDraft); 
                      setIsFilterOpen(false); 
                      console.log('Fetching cans map for date range:', filterDraft.start, 'to', filterDraft.end);
                      await fetchAndBuildCansMap(filterDraft.start, filterDraft.end); 
                    }}
                    className="flex-1 md:flex-initial h-9 md:h-8 text-xs md:text-sm"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {filteredAndAggregatedCustomers.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={handleExportPDF} title="Export PDF" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground px-2">
              <FileText className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline text-xs">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} title="Export Excel" className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white px-2">
              <FileSpreadsheet className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline text-xs">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleWhatsAppShare} title="Share on WhatsApp" className="px-2" style={{ borderColor: '#25D36650', color: '#25D366' }}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="hidden md:inline text-xs ml-1.5">WhatsApp</span>
            </Button>
          </>
        )}
      </div>

      {filteredAndAggregatedCustomers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {isSearching ? '🔍 Searching all records...' : (searchTerm ? 'No customers found matching your search.' : 'No customers found. Add your first customer!')}
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {showInactive ? (
                    <button
                      onClick={() => { if (inactiveSortCol === 'name') { setInactiveSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setInactiveSortCol('name'); setInactiveSortDir('asc'); } }}
                      className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity text-orange-600 font-semibold"
                    >
                      Name {inactiveSortCol === 'name' ? (inactiveSortDir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />) : <ArrowUpAZ className="h-3.5 w-3.5 opacity-20" />}
                    </button>
                  ) : 'Name'}
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>
                  {showInactive ? (
                    <button
                      onClick={() => { if (inactiveSortCol === 'address') { setInactiveSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setInactiveSortCol('address'); setInactiveSortDir('asc'); } }}
                      className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity text-orange-600 font-semibold"
                    >
                      Address {inactiveSortCol === 'address' ? (inactiveSortDir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />) : <ArrowUpAZ className="h-3.5 w-3.5 opacity-20" />}
                    </button>
                  ) : 'Address'}
                </TableHead>
                <TableHead className="w-[15%] text-center whitespace-nowrap">Payment Type</TableHead>
                <TableHead className="w-[12%] text-center whitespace-nowrap">Default Cans</TableHead>
                <TableHead className="w-[12%] text-center whitespace-nowrap">
                  {showInactive ? (
                    <button
                      onClick={() => { if (inactiveSortCol === 'price') { setInactiveSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setInactiveSortCol('price'); setInactiveSortDir('asc'); } }}
                      className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity text-orange-600 font-semibold"
                    >
                      Price/Can {inactiveSortCol === 'price' ? (inactiveSortDir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />) : <ArrowUpAZ className="h-3.5 w-3.5 opacity-20" />}
                    </button>
                  ) : 'Price/Can'}
                </TableHead>
                {showInactive && (
                  <TableHead className="w-[14%] text-center whitespace-nowrap text-orange-600">
                    <button
                      onClick={() => { if (inactiveSortCol === 'days') { setInactiveSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setInactiveSortCol('days'); setInactiveSortDir('asc'); } }}
                      className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity font-semibold"
                    >
                      Days Inactive {inactiveSortCol === 'days' ? (inactiveSortDir === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />) : <ArrowUpAZ className="h-3.5 w-3.5 opacity-20" />}
                    </button>
                  </TableHead>
                )}
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndAggregatedCustomers.map((customer, idx) => {
                const isSindhiName = /[\u0621-\u064a]/.test(customer.name);
                const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                return (
                  <TableRow 
                    key={customer._id || customer.customerId || idx}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onEditCustomer && onEditCustomer(customer)}
                  >
                    <TableCell className={nameClasses}>
                      <span>{(customer as any).id ? `${(customer as any).id} - ${customer.name}` : customer.name}</span>
                      {typeof customer.pricePerCan === 'number' && customer.pricePerCan >= 100 && (
                        <span aria-label="Premium" className="inline-flex ml-2 align-middle">
                          <Star className="h-3 w-3 text-yellow-500" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell className="whitespace-normal break-words max-w-xs">{customer.address}</TableCell>
                    <TableCell className="w-[15%] text-center whitespace-nowrap">
                      {(() => {
                        const pt = ((customer as any).paymentType || '').toString().toLowerCase();
                        const label = pt === 'account' ? 'Account' : 'Cash';
                        return <Badge variant="outline" className="capitalize">{label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="w-[12%] text-center whitespace-nowrap">{customer.defaultCans}</TableCell>
                    <TableCell className="w-[12%] text-center whitespace-nowrap">{typeof customer.pricePerCan === 'number' ? `Rs. ${customer.pricePerCan}` : '-'}</TableCell>
                    {showInactive && (() => {
                      const cid = String(customer._id || (customer as any).customerId || '');
                      const lastDate = lastDeliveryMap[cid];
                      const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (24 * 60 * 60 * 1000)) : null;
                      return (
                        <TableCell className="w-[14%] text-center whitespace-nowrap">
                          <span className={cn('font-semibold text-sm', days === null ? 'text-gray-400' : days > 30 ? 'text-red-600' : 'text-orange-500')}>
                            {days === null ? 'Never' : `${days}d`}
                          </span>
                        </TableCell>
                      );
                    })()}
                    <TableCell className="text-right">
                      {onEditCustomer && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCustomer(customer);
                          }} 
                          title="Edit Customer"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
          {/* Load More Button */}
          {!searchTerm && !isSearching && hasMore && !idSortOrder && !showInactive && (
            <div className="mt-4 flex justify-center">
              <Button 
                onClick={loadMoreCustomers} 
                disabled={isLoadingMore}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isLoadingMore ? (
                  <>Loading...</>
                ) : (
                  <>Load More ({currentPage}/{totalPages})</>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}), (prevProps, nextProps) => {
  // PHASE 5: Custom comparison - only re-render if onEditCustomer changes
  return prevProps.onEditCustomer === nextProps.onEditCustomer;
});

CustomerList.displayName = "CustomerList";

export default CustomerList;
    

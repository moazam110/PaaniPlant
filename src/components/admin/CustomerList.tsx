
"use client";

import React, { useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
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
import { Search, Pencil, Star, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { Button } from '@/components/ui/button'; // Added Button
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input as TextInput } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { ListFilter } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomerListProps {
  onEditCustomer?: (customer: Customer) => void; // Optional for now, will be used by AdminDashboardPage
}

export interface CustomerListRef {
  refreshCustomers: () => void;
}

const CustomerList = forwardRef<CustomerListRef, CustomerListProps>(({ onEditCustomer }, ref) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<{ start: string; end: string; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; ptCash: boolean; ptAccount: boolean }>({ start: '', end: '', cans: '', cansOp: '<', price: '', priceOp: '=', ptCash: false, ptAccount: false });
  const [activeFilter, setActiveFilter] = useState<{ start: string; end: string; cans: string; cansOp: '<' | '=' | '>'; price: string; priceOp: '<' | '=' | '>'; ptCash: boolean; ptAccount: boolean }>({ start: '', end: '', cans: '', cansOp: '<', price: '', priceOp: '=', ptCash: false, ptAccount: false });
  const [customerCansMap, setCustomerCansMap] = useState<Record<string, number>>({});
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: Customer[] = await response.json();
      console.log('Fetched customers:', data.length);
      // Ensure descending order by id (fallback createdAt)
      const sorted = [...data].sort((a, b) => {
        const aId = (a as any).id ?? 0;
        const bId = (b as any).id ?? 0;
        if (aId !== bId) return bId - aId;
        const aTime = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return bTime - aTime;
      });
      setAllCustomers(sorted);
      setError(null);

      // Fetch aggregated cans for current activeFilter
      await fetchAndBuildCansMap(activeFilter.start, activeFilter.end);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers.');
    } finally {
      setIsLoading(false);
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
    
    // Set up real-time updates every 60 seconds for customer list
    const interval = setInterval(fetchCustomers, 60000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    refreshCustomers: fetchCustomers,
  }));

  // Simple fuzzy search implementation
  const fuzzyMatch = (text: string, pattern: string): boolean => {
    if (!pattern) return true;
    if (!text) return false;
    
    const normalizedText = text.toLowerCase().replace(/\s+/g, '');
    const normalizedPattern = pattern.toLowerCase().replace(/\s+/g, '');
    
    // Exact match gets highest priority
    if (normalizedText.includes(normalizedPattern)) return true;
    
    // Character sequence match (allows missing characters between)
    let patternIndex = 0;
    for (let i = 0; i < normalizedText.length && patternIndex < normalizedPattern.length; i++) {
      if (normalizedText[i] === normalizedPattern[patternIndex]) {
        patternIndex++;
      }
    }
    
    // If we matched at least 70% of the pattern characters, it's a fuzzy match
    return patternIndex >= Math.ceil(normalizedPattern.length * 0.7);
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) {
      return allCustomers;
    }
    
    return allCustomers.filter(customer => {
      return (
        fuzzyMatch(customer.name, searchTerm) ||
        (customer.phone && fuzzyMatch(customer.phone, searchTerm)) ||
        fuzzyMatch(customer.address, searchTerm)
      );
    });
  }, [allCustomers, searchTerm]);

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

    if (!hasDateFilter && !hasCansFilter && !hasPriceFilter && !hasPtFilter && !addressSortOrder) {
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
    if (!addressSortOrder) return filtered;
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
  }, [filteredCustomers, activeFilter, customerCansMap, addressSortOrder]);

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
        <Button onClick={fetchCustomers} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, phone, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={fetchCustomers} variant="outline" size="sm">
          Refresh
        </Button>
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Filters">
              <ListFilter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block">Start Date (optional)</Label>
                  <TextInput
                    type="date"
                    value={filterDraft.start}
                    onChange={(e) => setFilterDraft(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">End Date (optional)</Label>
                  <TextInput
                    type="date"
                    value={filterDraft.end}
                    onChange={(e) => setFilterDraft(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block">Total Cans</Label>
                  <div className="flex gap-2">
                    <Select value={filterDraft.cansOp} onValueChange={(value: '<' | '=' | '>') => setFilterDraft(prev => ({ ...prev, cansOp: value }))}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<">Less than</SelectItem>
                        <SelectItem value="=">Equal to</SelectItem>
                        <SelectItem value=">">Greater than</SelectItem>
                      </SelectContent>
                    </Select>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={filterDraft.cans}
                      onChange={(e) => setFilterDraft(prev => ({ ...prev, cans: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Price per Can</Label>
                  <div className="flex gap-2">
                    <Select value={filterDraft.priceOp} onValueChange={(value: '<' | '=' | '>') => setFilterDraft(prev => ({ ...prev, priceOp: value }))}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<">Less than</SelectItem>
                        <SelectItem value="=">Equal to</SelectItem>
                        <SelectItem value=">">Greater than</SelectItem>
                      </SelectContent>
                    </Select>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={filterDraft.price}
                      onChange={(e) => setFilterDraft(prev => ({ ...prev, price: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Type</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ptCash"
                      checked={filterDraft.ptCash}
                      onCheckedChange={(checked) => setFilterDraft(prev => ({ ...prev, ptCash: checked as boolean }))}
                    />
                    <Label htmlFor="ptCash">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ptAccount"
                      checked={filterDraft.ptAccount}
                      onCheckedChange={(checked) => setFilterDraft(prev => ({ ...prev, ptAccount: checked as boolean }))}
                    />
                    <Label htmlFor="ptAccount">Account</Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    variant={addressSortOrder === 'asc' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddressSortOrder(prev => (prev === 'asc' ? null : 'asc'))}
                    title="Ascending"
                  >
                    <ArrowUpAZ className="h-4 w-4 mr-1" /> Asc
                  </Button>
                  <Button
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
                <Button variant="outline" onClick={() => { setFilterDraft({ start: '', end: '', cans: '', cansOp: '<', price: '', priceOp: '=', ptCash: false, ptAccount: false }); }}>Clear</Button>
                <Button onClick={async () => { 
                  console.log('Apply button clicked with filter:', filterDraft);
                  setActiveFilter(filterDraft); 
                  setIsFilterOpen(false); 
                  console.log('Fetching cans map for date range:', filterDraft.start, 'to', filterDraft.end);
                  await fetchAndBuildCansMap(filterDraft.start, filterDraft.end); 
                }}>Apply</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {filteredAndAggregatedCustomers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'No customers found matching your search.' : 'No customers found. Add your first customer!'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-[15%] text-center whitespace-nowrap">Payment Type</TableHead>
                <TableHead className="w-[12%] text-center whitespace-nowrap">Default Cans</TableHead>
                <TableHead className="w-[12%] text-center whitespace-nowrap">Price/Can</TableHead>
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
                    <TableCell className="w-[12%] text-center whitespace-nowrap">{customer.pricePerCan ? `Rs. ${customer.pricePerCan}` : '-'}</TableCell>
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
      )}
    </div>
  );
});

CustomerList.displayName = "CustomerList";

export default CustomerList;
    

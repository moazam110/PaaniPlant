"use client";

/**
 * Customer Access Management Component
 * 
 * Allows admin to:
 * - View all customers
 * - Enable/disable dashboard access
 * - Generate/assign username and password
 * - View/manage customer credentials
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff, Key, UserPlus, Save, X, CheckCircle2, MapPin, Phone, User, Search, Wifi, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import type { Customer } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn, formatLastOnline } from '@/lib/utils';

interface CustomerCredential {
  _id?: string;
  customerId: string | { _id: string; id: number; name: string; address: string; phone?: string; lastOnlineAt?: string };
  username: string;
  hasDashboardAccess: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerAccessManagementProps {
  onClose: () => void;
}

// Colour the last-online label by how stale it is, so customers who have
// drifted off the portal (and are ordering by phone again) stand out.
const lastOnlineClass = (val: any): string => {
  if (!val) return 'text-destructive';
  const ms = Date.now() - new Date(val).getTime();
  if (ms < 86400000) return 'text-green-600 dark:text-green-400';      // within a day
  if (ms < 604800000) return 'text-muted-foreground';                  // within a week
  return 'text-orange-600 dark:text-orange-400';                       // a week or more
};

const DAY_MS = 24 * 60 * 60 * 1000;

// How long since the customer last opened the dashboard.
// Never-opened counts as infinitely inactive, so it satisfies every threshold
// below and always sorts to the stale end of the list.
const inactiveMs = (val: any): number =>
  val ? Date.now() - new Date(val).getTime() : Number.POSITIVE_INFINITY;

type ActivityFilter = 'all' | '3d' | '1w' | '1m' | '3m' | 'never';

// Cumulative thresholds: each option shows everyone inactive AT LEAST this long,
// so staler groups are always swept into the shorter periods.
const ACTIVITY_FILTERS: { value: ActivityFilter; label: string; minMs: number }[] = [
  { value: 'all',   label: 'All customers',      minMs: 0 },
  { value: '3d',    label: 'Inactive 3+ days',   minMs: 3 * DAY_MS },
  { value: '1w',    label: 'Inactive 1+ week',   minMs: 7 * DAY_MS },
  { value: '1m',    label: 'Inactive 1+ month',  minMs: 30 * DAY_MS },
  { value: '3m',    label: 'Inactive 3+ months', minMs: 90 * DAY_MS },
  { value: 'never', label: 'Never opened',       minMs: Number.POSITIVE_INFINITY },
];

export default function CustomerAccessManagement({ onClose }: CustomerAccessManagementProps) {
  const { toast } = useToast();
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [credentials, setCredentials] = useState<Map<string, CustomerCredential>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [editingCredential, setEditingCredential] = useState<{ customerId: string; username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState<Set<string>>(new Set());
  const [generatingPassword, setGeneratingPassword] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  // null = untouched, so the list keeps its default customer-ID ordering
  const [activityFilter, setActivityFilter] = useState<ActivityFilter | null>(null);
  const [activitySortDir, setActivitySortDir] = useState<'asc' | 'desc'>('asc');

  // Load all customers without pagination when Grant Access is clicked
  const fetchAllCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      // Fetch all customers without pagination (use a very high limit or fetch all pages)
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=10000`));
      
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
      setIsLoadingCustomers(false);
      console.log(`✅ Loaded all ${sorted.length} customers sorted by ID ascending`);
    } catch (err) {
      console.error('Failed to fetch all customers:', err);
      setIsLoadingCustomers(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customers.",
      });
    }
  };

  // Load customers with access on mount
  useEffect(() => {
    fetchCredentials();
  }, []);

  // Fetch all customers when Grant Access button is clicked
  useEffect(() => {
    if (showAllCustomers) {
      fetchAllCustomers();
    }
  }, [showAllCustomers]);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const credentialsRes = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOMER_CREDENTIALS));
      
      if (credentialsRes.ok) {
        const contentType = credentialsRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const credentialsData = await credentialsRes.json();
          
          const credentialsMap = new Map<string, CustomerCredential>();
          const customersWithAccess: Customer[] = [];
          
          if (Array.isArray(credentialsData)) {
            credentialsData.forEach((cred: any) => {
              // Handle customerId - could be ObjectId string or populated object
              let customerId: string = '';
              let customerData: Customer | null = null;
              
              if (typeof cred.customerId === 'object' && cred.customerId !== null) {
                // Populated customer
                customerId = String(cred.customerId._id || cred.customerId.id || '');
                // Extract customer data from populated object
                customerData = {
                  _id: cred.customerId._id,
                  id: cred.customerId.id,
                  name: cred.customerId.name || '',
                  address: cred.customerId.address || '',
                  phone: cred.customerId.phone || '',
                  defaultCans: cred.customerId.defaultCans,
                  pricePerCan: cred.customerId.pricePerCan,
                  paymentType: cred.customerId.paymentType,
                  lastOnlineAt: cred.customerId.lastOnlineAt,
                } as Customer;
              } else {
                // Just ObjectId string
                customerId = String(cred.customerId || '');
              }
              
              if (customerId) {
                credentialsMap.set(customerId, cred);
                // Add customer data if available and has dashboard access
                if (cred.hasDashboardAccess && customerData) {
                  customersWithAccess.push(customerData);
                }
              }
            });
          }
          
          setCredentials(credentialsMap);
          
          // Set customers with access to display them immediately
          if (customersWithAccess.length > 0) {
            setAllCustomers(customersWithAccess);
            console.log(`✅ Loaded ${customersWithAccess.length} customers with dashboard access`);
          }
        }
      } else if (credentialsRes.status === 404) {
        // No credentials exist yet
        setCredentials(new Map());
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customer credentials. Please check if the backend is running.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
    if (typeof window !== 'undefined' && window.crypto) {
      return Array.from(window.crypto.getRandomValues(new Uint8Array(length)))
        .map(x => charset[x % charset.length])
        .join('');
    }
    // Fallback for server-side or if crypto is not available
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    return password;
  };

  const handleGeneratePassword = (customerId: string) => {
    setGeneratingPassword(prev => new Set(prev).add(customerId));
    const newPassword = generatePassword();
    setEditingCredential({
      customerId,
      username: credentials.get(customerId)?.username || '',
      password: newPassword,
    });
    setTimeout(() => {
      setGeneratingPassword(prev => {
        const next = new Set(prev);
        next.delete(customerId);
        return next;
      });
    }, 500);
  };

  const handleSaveCredential = async (customerId: string, username: string, password: string, hasAccess: boolean) => {
    try {
      const url = buildApiUrl(API_ENDPOINTS.CUSTOMER_CREDENTIALS);
      console.log('Saving credential to:', url);
      console.log('Request body:', { customerId, username, hasDashboardAccess: hasAccess });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          username,
          password,
          hasDashboardAccess: hasAccess,
        }),
      });
      
      console.log('Response status:', response.status, response.statusText);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned ${response.status}: ${response.statusText}. Please check if the backend API is running.`);
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to save credential: ${response.status} ${response.statusText}`);
      }

      const updatedCredential = await response.json();
      console.log('Saved credential:', updatedCredential);
      
      setCredentials(prev => {
        const next = new Map(prev);
        next.set(customerId, updatedCredential);
        return next;
      });

      // Refresh credentials list
      await fetchCredentials();
      
      setEditingCredential(null);
      toast({
        title: "Success",
        description: "Customer credential saved successfully.",
      });
    } catch (error: any) {
      console.error('Error saving credential:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save credential. Please check if the backend is running.",
      });
    }
  };

  const handleToggleAccess = async (customerId: string, hasAccess: boolean) => {
    const credential = credentials.get(customerId);
    if (!credential) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please create credentials first.",
      });
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMER_CREDENTIALS}/${customerId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasDashboardAccess: hasAccess,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned ${response.status}: ${response.statusText}. Please check if the backend API is running.`);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `Failed to update access: ${response.status} ${response.statusText}` }));
        throw new Error(error.error || 'Failed to update access');
      }

      const updatedCredential = await response.json();
      setCredentials(prev => {
        const next = new Map(prev);
        next.set(customerId, updatedCredential);
        return next;
      });

      // Refresh credentials list
      await fetchCredentials();

      toast({
        title: "Success",
        description: `Dashboard access ${hasAccess ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error updating access:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update dashboard access.",
      });
    }
  };

  const handleDeleteCredential = async (customerId: string) => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMER_CREDENTIALS}/${customerId}`), {
        method: 'DELETE',
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || `Failed to delete credential: ${response.status} ${response.statusText}`);
        } else {
          const text = await response.text();
          console.error('Non-JSON response:', text.substring(0, 200));
          throw new Error(`Server returned ${response.status}: ${response.statusText}. Please check if the backend API is running.`);
        }
      }

      setCredentials(prev => {
        const next = new Map(prev);
        next.delete(customerId);
        return next;
      });

      // Refresh credentials list
      await fetchCredentials();

      toast({
        title: "Success",
        description: "Customer credential deleted.",
      });
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete credential.",
      });
    }
  };

  // Display customers based on showAllCustomers state
  // MUST be before any conditional returns (Rules of Hooks)
  const displayCustomers = useMemo(() => {
    const byIdAsc = (a: Customer, b: Customer) => (((a as any).id || 0) - ((b as any).id || 0));
    let list: Customer[];
    if (showAllCustomers) {
      list = [...allCustomers].sort(byIdAsc);
    } else {
      // Credentials come back in insertion order, so sort here too — this is the
      // resting order the list returns to when the activity filter is cleared.
      list = allCustomers.filter(customer => {
        const rawCustomerId = customer._id || (customer as any).customerId;
        const customerId = rawCustomerId && typeof rawCustomerId === 'object'
          ? String(rawCustomerId._id || rawCustomerId)
          : String(rawCustomerId || '');
        return credentials.has(customerId) && credentials.get(customerId)?.hasDashboardAccess;
      }).sort(byIdAsc);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => String((c as any).id || '').toLowerCase().includes(q));
    }

    // Activity filter + recency ordering only kick in once the admin picks
    // something; until then the list keeps its customer-ID ordering.
    if (activityFilter) {
      const minMs = ACTIVITY_FILTERS.find(f => f.value === activityFilter)?.minMs ?? 0;
      list = list.filter(c => inactiveMs(c.lastOnlineAt) >= minMs);
      list = [...list].sort((a, b) => {
        const aMs = inactiveMs(a.lastOnlineAt);
        const bMs = inactiveMs(b.lastOnlineAt);
        // Compared rather than subtracted so two never-opened customers
        // (Infinity - Infinity = NaN) don't corrupt the sort.
        const diff = aMs === bMs ? 0 : aMs < bMs ? -1 : 1;
        return activitySortDir === 'asc' ? diff : -diff;
      });
    }
    return list;
  }, [allCustomers, credentials, showAllCustomers, searchQuery, activityFilter, activitySortDir]);

  // Loading state - must be after all hooks
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grant Access Button (centered) + Activity Filter (right) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-center">
        {/* Empty column so the button lands on the true centre of the row */}
        <div className="hidden lg:block" aria-hidden="true" />

        <div className="flex justify-center">
          <Button
            onClick={() => setShowAllCustomers(!showAllCustomers)}
            variant={showAllCustomers ? "outline" : "default"}
            className={showAllCustomers ? "" : "bg-primary hover:bg-primary/90"}
            disabled={isLoadingCustomers}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {isLoadingCustomers ? "Loading..." : showAllCustomers ? "Hide All Customers" : "Grant Access"}
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:justify-end">
          <Select
            value={activityFilter ?? undefined}
            onValueChange={(v) => setActivityFilter(v as ActivityFilter)}
          >
            <SelectTrigger className="flex-1 lg:flex-none lg:w-[190px]">
              <SelectValue placeholder="Filter by activity" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activityFilter && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setActivitySortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                title={activitySortDir === 'asc'
                  ? 'Most recently active first — click for never-opened first'
                  : 'Never opened first — click for most recently active first'}
              >
                {activitySortDir === 'asc'
                  ? <ArrowUpAZ className="h-4 w-4" />
                  : <ArrowDownAZ className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                onClick={() => { setActivityFilter(null); setActivitySortDir('asc'); }}
                title="Clear filter and return to customer ID order"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {activityFilter && (
          <p className="text-xs text-muted-foreground px-1">
            {displayCustomers.length} customer{displayCustomers.length === 1 ? '' : 's'}
            {' · '}
            {activitySortDir === 'asc' ? 'most recently active first' : 'never opened first'}
          </p>
        )}
      </div>

      {/* Customers List */}
      {displayCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              {activityFilter ? (
                <>
                  <p className="text-lg font-semibold">No customers match this filter</p>
                  <p className="text-sm text-muted-foreground">Try a shorter inactivity period, or clear the filter.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">No customers with dashboard access yet</p>
                  <p className="text-sm text-muted-foreground">Click "Grant Access" to view all customers and grant access</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {displayCustomers.map((customer) => {
          // Get the MongoDB ObjectId - prefer _id, fallback to customerId
          const rawCustomerId = customer._id || (customer as any).customerId;
          const customerId = rawCustomerId && typeof rawCustomerId === 'object'
            ? String(rawCustomerId._id || rawCustomerId)
            : String(rawCustomerId || '');
          
          const credential = credentials.get(customerId);
          const isEditing = editingCredential?.customerId === customerId;
          const showPass = showPassword.has(customerId);

          return (
            <Card key={customerId} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {(customer as any).id && (
                            <span className="text-muted-foreground mr-2">#{((customer as any).id)}</span>
                          )}
                          {customer.name}
                        </h3>
                      </div>
                      {credential?.hasDashboardAccess ? (
                        <Badge variant="default" className="shrink-0">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : credential ? (
                        <Badge variant="secondary" className="shrink-0">Inactive</Badge>
                      ) : null}
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{customer.address}</span>
                      </p>
                      {customer.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.phone}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
                        {credential ? (
                          <span className="flex items-center gap-2 min-w-0">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded truncate">
                              {credential.username}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">No portal account</span>
                        )}
                        <span
                          className={cn('flex items-center gap-1.5 shrink-0 text-xs font-medium', lastOnlineClass(customer.lastOnlineAt))}
                          title={customer.lastOnlineAt
                            ? `Last opened the customer dashboard on ${new Date(customer.lastOnlineAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })}`
                            : 'Has never opened the customer dashboard'}
                        >
                          <Wifi className="h-3.5 w-3.5" />
                          {formatLastOnline(customer.lastOnlineAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    {credential && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`access-${customerId}`} className="text-xs text-muted-foreground">
                          Access
                        </Label>
                        <Switch
                          id={`access-${customerId}`}
                          checked={credential.hasDashboardAccess}
                          onCheckedChange={(checked) => handleToggleAccess(customerId, checked)}
                        />
                      </div>
                    )}

                    {!credential ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const newPassword = generatePassword();
                          setEditingCredential({
                            customerId: customerId,
                            username: '',
                            password: newPassword,
                          });
                        }}
                        className="whitespace-nowrap"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Grant Access
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCredential({
                              customerId: customerId,
                              username: credential.username,
                              password: '',
                            });
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCredential(customerId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={editingCredential.username}
                        onChange={(e) => setEditingCredential({
                          ...editingCredential,
                          username: e.target.value,
                        })}
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <div className="relative">
                        <Input
                          type={showPass ? "text" : "password"}
                          value={editingCredential.password}
                          onChange={(e) => setEditingCredential({
                            ...editingCredential,
                            password: e.target.value,
                          })}
                          placeholder="Enter password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                        onClick={() => {
                          setShowPassword(prev => {
                            const next = new Set(prev);
                            if (next.has(customerId)) {
                              next.delete(customerId);
                            } else {
                              next.add(customerId);
                            }
                            return next;
                          });
                        }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPass ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (editingCredential.username && editingCredential.password) {
                            handleSaveCredential(
                              editingCredential.customerId,
                              editingCredential.username,
                              editingCredential.password,
                              credential?.hasDashboardAccess || true
                            );
                          }
                        }}
                        disabled={!editingCredential.username || !editingCredential.password}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                          onClick={() => handleGeneratePassword(customerId)}
                          disabled={generatingPassword.has(customerId)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          {generatingPassword.has(customerId) ? 'Generating...' : 'Generate Password'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCredential(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}


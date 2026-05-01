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
import { Eye, EyeOff, Key, UserPlus, Save, X, CheckCircle2, MapPin, Phone, User, Search } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import type { Customer } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CustomerCredential {
  _id?: string;
  customerId: string | { _id: string; id: number; name: string; address: string; phone?: string };
  username: string;
  hasDashboardAccess: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerAccessManagementProps {
  onClose: () => void;
}

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
    let list: Customer[];
    if (showAllCustomers) {
      list = [...allCustomers].sort((a, b) => {
        const aId = (a as any).id || 0;
        const bId = (b as any).id || 0;
        return aId - bId;
      });
    } else {
      list = allCustomers.filter(customer => {
        const rawCustomerId = customer._id || (customer as any).customerId;
        const customerId = rawCustomerId && typeof rawCustomerId === 'object'
          ? String(rawCustomerId._id || rawCustomerId)
          : String(rawCustomerId || '');
        return credentials.has(customerId) && credentials.get(customerId)?.hasDashboardAccess;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => String((c as any).id || '').toLowerCase().includes(q));
    }
    return list;
  }, [allCustomers, credentials, showAllCustomers, searchQuery]);

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
      {/* Grant Access Button - Centered at Top */}
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Customer ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customers List */}
      {displayCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No customers with dashboard access yet</p>
              <p className="text-sm text-muted-foreground">Click "Grant Access" to view all customers and grant access</p>
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
                      {credential && (
                        <p className="flex items-center gap-2 mt-2 pt-2 border-t">
                          <User className="h-3.5 w-3.5" />
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            {credential.username}
                          </span>
                        </p>
                      )}
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


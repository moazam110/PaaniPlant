
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle, Ban, Plus, Minus } from 'lucide-react';
import type { Customer, DeliveryRequest } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const createDeliveryRequestSchema = z.object({
  cans: z.coerce.number().min(1, { message: "Number of cans must be at least 1." }),
  orderDetails: z.string().optional(),
  priority: z.enum(['normal', 'urgent'], { required_error: "Priority is required." }),
});

type CreateDeliveryRequestFormValues = z.infer<typeof createDeliveryRequestSchema>;

interface CreateDeliveryRequestFormProps {
  onSuccess?: () => void;
  onCloseDialog?: () => void; 
  customerToPreselect?: Customer | null;
  editingRequest?: DeliveryRequest | null;
}

export default function CreateDeliveryRequestForm({
  onSuccess,
  onCloseDialog,
  customerToPreselect,
  editingRequest,
}: CreateDeliveryRequestFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
  const [customersWithActiveRequests, setCustomersWithActiveRequests] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialHoldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const holdStopCleanupRef = useRef<() => void>(() => {});

  const isEditMode = !!editingRequest;
  // A request can be cancelled if it's in 'edit mode' AND its status is 'pending', 'pending_confirmation', or 'processing'
  const canCancelRequest = isEditMode && editingRequest && (editingRequest.status === 'pending' || editingRequest.status === 'pending_confirmation' || editingRequest.status === 'processing');

  const form = useForm<CreateDeliveryRequestFormValues>({
    resolver: zodResolver(createDeliveryRequestSchema),
    defaultValues: {
      cans: editingRequest?.cans || customerToPreselect?.defaultCans || 1,
      orderDetails: editingRequest?.orderDetails || "",
      priority: editingRequest?.priority || "normal",
    },
  });

  // Fetch customers and their active request status
  useEffect(() => {
    if (editingRequest) {
      const customerForEdit: Customer = {
        _id: (editingRequest as any).customerId as any,
        id: (editingRequest as any).customerIntId ?? 0,
        customerId: editingRequest.customerId,
        name: editingRequest.customerName,
        address: editingRequest.address,
        defaultCans: editingRequest.cans, 
        pricePerCan: (editingRequest as any).pricePerCan,
        notes: '',
        phone: '',
        createdAt: '', 
        updatedAt: '', 
        paymentType: (editingRequest as any).paymentType,
      };
      setSelectedCustomer(customerForEdit);
      form.reset({
        cans: editingRequest.cans,
        orderDetails: editingRequest.orderDetails || "",
        priority: editingRequest.priority,
      });
      setIsLoadingCustomers(false);
    } else if (customerToPreselect) {
      const ensured: Customer = {
        ...(customerToPreselect as any),
        id: (customerToPreselect as any).id ?? 0,
      } as Customer;
      setSelectedCustomer(ensured);
      form.reset({
        cans: customerToPreselect.defaultCans || 1,
        orderDetails: "",
        priority: "normal",
      });
      setIsLoadingCustomers(false);
    } else {
      const fetchCustomersAndActiveRequests = async () => {
        setIsLoadingCustomers(true);
        try {
          const customersResponse = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS));
          
          if (!customersResponse.ok) {
            throw new Error(`HTTP error! status: ${customersResponse.status}`);
          }
          
          const customersData = await customersResponse.json();
          setAllCustomers(customersData);

          // Fetch active requests to prevent duplicates
          const requestsResponse = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS));
          if (requestsResponse.ok) {
            const requestsData: DeliveryRequest[] = await requestsResponse.json();
            const activeCustomerIds = new Set<string>();
            
            requestsData
              .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
              .forEach(req => {
                const raw = (req as any).customerId;
                const normalized = raw && typeof raw === 'object' 
                  ? String(raw._id ?? raw.id ?? '') 
                  : String(raw ?? '');
                if (normalized) {
                  activeCustomerIds.add(normalized);
                }
              });
              
            setCustomersWithActiveRequests(activeCustomerIds);
          }
        } catch (error) {
          console.error("Error fetching customers:", error);
          toast({
            variant: "destructive",
            title: "Failed to load customers",
            description: "Could not fetch customer list for selection.",
          });
          setAllCustomers([]);
        } finally {
          setIsLoadingCustomers(false);
        }
      };
      
      // Initial fetch
      fetchCustomersAndActiveRequests();
      
      // Set up real-time updates every 5 seconds to refresh active customers
      const interval = setInterval(fetchCustomersAndActiveRequests, 5000);
      
      form.reset({ cans: 1, orderDetails: "", priority: "normal" });
      setSelectedCustomer(null);
      
      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }
  }, [toast, form, customerToPreselect, editingRequest]);

  // Standard search filtering - only show customers that match the search term
  const filteredCustomers = useMemo(() => {
    if (isEditMode || customerToPreselect) return [];
    if (!searchTerm.trim()) return [];

    return allCustomers
      .filter(customer => {
        const searchLower = searchTerm.toLowerCase().trim();
        const nameLower = customer.name.toLowerCase();
        // Do NOT exclude; show but disable selection to match working version UX
        return (
          nameLower.includes(searchLower) ||
          (customer.phone && customer.phone.includes(searchTerm)) ||
          customer.address.toLowerCase().includes(searchLower)
        );
      })
      .slice(0, 8);
  }, [allCustomers, searchTerm, customerToPreselect, isEditMode]);

  const handleSelectCustomer = async (customer: Customer) => {
    // Check if customer has active requests
    const raw = (customer as any)._id || (customer as any).customerId;
    const normalized = raw && typeof raw === 'object' 
      ? String(raw._id ?? raw.id ?? '') 
      : String(raw ?? '');
    const hasActiveRequest = customersWithActiveRequests.has(normalized || '');
    
    if (hasActiveRequest) {
      toast({
        variant: "destructive",
        title: "Active Request Exists",
        description: `${customer.name} already has an active delivery request. Please wait until it's delivered before creating a new one.`,
      });
      return;
    }

    setSelectedCustomer(customer);
    form.setValue("cans", customer.defaultCans || 1);
    // Do NOT clear search automatically; keep it so multiple city-specific requests are easy
    // setSearchTerm('');
  };

  const onSubmit = async (data: CreateDeliveryRequestFormValues) => {
    if (!selectedCustomer && !isEditMode) { 
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please search and select a customer.",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      if (isEditMode && editingRequest) {
        const response = await fetch(buildApiUrl(`api/delivery-requests/${editingRequest._id || editingRequest.requestId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            customerId: selectedCustomer?._id || selectedCustomer?.customerId || editingRequest.customerId,
            customerName: selectedCustomer?.name || editingRequest.customerName,
            address: selectedCustomer?.address || editingRequest.address,
            // carry-through values if available
            pricePerCan: (selectedCustomer as any)?.pricePerCan ?? (editingRequest as any)?.pricePerCan,
            paymentType: (selectedCustomer as any)?.paymentType ?? (editingRequest as any)?.paymentType,
          }),
        });
        
        if (response.ok) {
          // Success notification removed
        } else {
          throw new Error('Failed to update request');
        }
      } else if (selectedCustomer) {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            customerId: selectedCustomer._id || (selectedCustomer as any).customerId,
            customerIntId: (selectedCustomer as any).id,
            customerName: selectedCustomer.name,
            address: selectedCustomer.address,
            // include denormalized values for table rendering
            pricePerCan: (selectedCustomer as any)?.pricePerCan,
            paymentType: (selectedCustomer as any)?.paymentType || 'cash',
          }),
        });
        
        if (response.ok) {
          // Success: optimistically mark this customer as active immediately
          const raw = (selectedCustomer as any)._id || (selectedCustomer as any).customerId;
          const normalized = raw && typeof raw === 'object'
            ? String(raw._id ?? raw.id ?? '')
            : String(raw ?? '');
          if (normalized) {
            setCustomersWithActiveRequests(prev => {
              const next = new Set(prev);
              next.add(normalized);
              return next;
            });
          }
          // Fire-and-forget refresh in background (do not await)
          (async () => {
            try {
              const requestsResponse = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS));
              if (requestsResponse.ok) {
                const requestsData: DeliveryRequest[] = await requestsResponse.json();
                const activeCustomerIds = new Set<string>();
                requestsData
                  .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
                  .forEach(req => {
                    const r = (req as any).customerId;
                    const n = r && typeof r === 'object' ? String(r._id ?? r.id ?? '') : String(r ?? '');
                    if (n) activeCustomerIds.add(n);
                  });
                setCustomersWithActiveRequests(activeCustomerIds);
              }
            } catch {}
          })();
        } else {
          throw new Error('Failed to create request');
        }
      }

      form.reset();
      setSelectedCustomer(null);
      // Keep the search term so multiple city-specific requests are easy

      // Do not auto-blur cursor; user can press backslash to blur explicitly
      // const activeElement = document.activeElement as HTMLElement;
      // if (activeElement && activeElement.blur) {
      //   activeElement.blur();
      // }
      
      if (onSuccess) {
        onSuccess();
      }
      if (onCloseDialog) {
        onCloseDialog();
      }
    } catch (error: any) {
      console.error("Error submitting delivery request:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helpers for continuous +/- hold
  const stopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (initialHoldTimeoutRef.current) {
      clearTimeout(initialHoldTimeoutRef.current);
      initialHoldTimeoutRef.current = null;
    }
    if (holdStopCleanupRef.current) {
      holdStopCleanupRef.current();
      holdStopCleanupRef.current = () => {};
    }
    isHoldingRef.current = false;
  };

  const startHold = (callback: () => void) => {
    if (isHoldingRef.current) return;
    isHoldingRef.current = true;
    // Single tap: apply one step immediately
    callback();
    // Hold-to-repeat: start repeating only after a 1s delay
    initialHoldTimeoutRef.current = setTimeout(() => {
      // Ensure user is still holding
      if (isHoldingRef.current) {
        holdIntervalRef.current = setInterval(callback, 100);
      }
    }, 1000);
    const stop = () => stopHold();
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop as any, { passive: true });
    holdStopCleanupRef.current = () => {
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchend', stop as any);
    };
  };

  useEffect(() => {
    return () => {
      // Cleanup any running intervals on unmount
      stopHold();
    };
  }, []);

  const handleMarkRequestAsCancelled = async () => {
    if (!editingRequest) return; // Should not happen if button is shown correctly
    setIsSubmitting(true);
    try {
      const actualRequestId = editingRequest._id || editingRequest.requestId;
      const response = await fetch(buildApiUrl(`api/delivery-requests/${actualRequestId}/cancel`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setIsCancelConfirmationOpen(false);
        
        toast({
          title: "Request Cancelled",
          description: `Delivery request for ${editingRequest.customerName} has been cancelled.`,
        });
        
        // Refresh the request list
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to cancel request');
      }
    } catch (err) {
      console.error("Error cancelling request:", err);
      toast({
        variant: "destructive",
        title: "Cancellation Failed",
        description: err instanceof Error ? err.message : "Could not cancel the request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {!selectedCustomer && !customerToPreselect && !isEditMode ? (
          <div className="space-y-3">
            <FormLabel htmlFor="customerSearch">Search Customer</FormLabel>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="customerSearch"
                ref={searchInputRef}
                placeholder="Search by name, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === '\\') {
                    // Explicitly allow user to remove cursor by pressing backslash
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                className="pl-10"
                disabled={isLoadingCustomers || isSubmitting}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>
            {isLoadingCustomers && <p className="text-sm text-muted-foreground">Loading customers...</p>}
            {searchTerm && !isLoadingCustomers && filteredCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground">No customers found matching "{searchTerm}".</p>
            )}
            {filteredCustomers.length > 0 && (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredCustomers.map(customer => {
                    const isSindhiName = /[ء-ي]/.test(customer.name);
                    const nameClasses = cn("font-medium", isSindhiName ? 'font-sindhi rtl' : 'ltr');
                    const customerId = customer._id || customer.customerId;
                    const hasActiveRequest = customersWithActiveRequests.has(customerId || '');

                    return (
                      <Button
                        key={customer._id || customer.customerId}
                        type="button"
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-auto p-2 text-left relative",
                          hasActiveRequest ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"
                        )}
                        onClick={() => handleSelectCustomer(customer)}
                        disabled={isSubmitting || hasActiveRequest}
                      >
                        <Avatar className="h-8 w-8 mr-3">
                          <AvatarFallback>
                            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={nameClasses}>{customer.name}</p>
                            {hasActiveRequest && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full ml-2">
                                Active Order
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{customer.address}</p>
                          {(customer as any).pricePerCan !== undefined && (
                            <p className="text-xs text-green-600 font-medium">Rs. {(customer as any).pricePerCan}/can</p>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : selectedCustomer && (
          <Card>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    <span className="text-lg font-medium">
                      {isEditMode ? "Editing Request for" : "Creating Request for"}
                    </span>
                  </div>
                  <p className={cn("font-semibold mt-1", /[ء-ي]/.test(selectedCustomer.name) ? 'font-sindhi rtl' : 'ltr')}>
                    {(selectedCustomer as any).id ? `${(selectedCustomer as any).id} - ${selectedCustomer.name}` : selectedCustomer.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.address}</p>
                </div>
                {!customerToPreselect && !isEditMode && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      form.reset({ cans: 1, orderDetails: "", priority: "normal" });
                    }}
                    className="p-0 h-auto"
                    disabled={isSubmitting}
                  >
                    Change
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

        <fieldset disabled={(!selectedCustomer && !isEditMode) || isSubmitting} className="space-y-6">
          <FormField
            control={form.control}
            name="cans"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Cans</FormLabel>
                <FormControl>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onMouseDown={() => startHold(() => {
                        const currentValue = Number(form.getValues('cans')) || 1;
                        if (currentValue > 1) form.setValue('cans', currentValue - 1);
                      })}
                      onMouseUp={stopHold}
                      onMouseLeave={stopHold}
                      onTouchStart={(e) => { e.preventDefault(); startHold(() => {
                        const currentValue = Number(form.getValues('cans')) || 1;
                        if (currentValue > 1) form.setValue('cans', currentValue - 1);
                      }); }}
                      onTouchEnd={stopHold}
                      disabled={isSubmitting || (Number(field.value) || 1) <= 1}
                      className="h-10 w-10"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center">
                      <span className="text-lg font-semibold px-4 py-2 bg-muted rounded-md min-w-[60px] inline-block">
                        {field.value || 1}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onMouseDown={() => startHold(() => {
                        const currentValue = Number(form.getValues('cans')) || 1;
                        form.setValue('cans', currentValue + 1);
                      })}
                      onMouseUp={stopHold}
                      onMouseLeave={stopHold}
                      onTouchStart={(e) => { e.preventDefault(); startHold(() => {
                        const currentValue = Number(form.getValues('cans')) || 1;
                        form.setValue('cans', currentValue + 1);
                      }); }}
                      onTouchEnd={stopHold}
                      disabled={isSubmitting}
                      className="h-10 w-10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order Details / Customer Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="e.g., Specific brand, leave at front door" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="normal" />
                      </FormControl>
                      <FormLabel className="font-normal">Normal</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="urgent" />
                      </FormControl>
                      <FormLabel className="font-normal">Urgent</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-4 border-t">
             {/* Cancel button for an existing request being edited (if eligible) */}
            {canCancelRequest && (
                <AlertDialog open={isCancelConfirmationOpen} onOpenChange={setIsCancelConfirmationOpen}>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" className="w-full sm:w-auto" disabled={isSubmitting}>
                            <Ban className="mr-2 h-4 w-4" />
                            Cancel This Delivery
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this delivery request for {editingRequest?.customerName}? This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsCancelConfirmationOpen(false)} disabled={isSubmitting}>Dismiss</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkRequestAsCancelled} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Yes, Cancel Delivery
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
             <Button type="button" variant="outline" onClick={onCloseDialog} className="w-full sm:w-auto" disabled={isSubmitting}>
                {isEditMode ? "Close" : "Cancel"} {/* "Cancel" for new request, "Close" if just viewing/editing */}
            </Button>
            <Button 
                type="submit" 
                className="w-full sm:w-auto" 
                disabled={(!selectedCustomer && !isEditMode) || isSubmitting}
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting 
                    ? (isEditMode ? "Updating..." : "Creating...") 
                    : (isEditMode ? "Update Request" : "Create Delivery Request")
                }
            </Button>
        </div>
      </form>
    </Form>
  );
}

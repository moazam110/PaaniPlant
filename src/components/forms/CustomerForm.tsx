
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import type { Customer } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Schema without profilePicture
const customerFormSchema = z.object({
  name: z.string().min(1, { message: "Customer name is required." }),
  phone: z.string().optional(),
  address: z.string().min(1, { message: "Address is required." }),
  defaultCans: z.coerce.number().min(0, { message: "Default cans cannot be negative." }).default(1),
  pricePerCan: z.coerce.number().min(1, { message: "Price per can is required and must be greater than 0." }).max(999, { message: "Price cannot exceed 999." }),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  editingCustomer?: Customer | null;
  onSuccess?: () => void;
}

export default function CustomerForm({ editingCustomer, onSuccess }: CustomerFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameManuallySetRtl, setNameManuallySetRtl] = useState(false);
  const isEditMode = !!editingCustomer;
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [totalCansReceived, setTotalCansReceived] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      defaultCans: 1,
      pricePerCan: 1, // Set to minimum allowed value
      notes: "",
    },
  });

  useEffect(() => {
    if (isEditMode && editingCustomer) {
      form.reset({
        name: editingCustomer.name,
        phone: editingCustomer.phone || "",
        address: editingCustomer.address,
        defaultCans: editingCustomer.defaultCans,
        pricePerCan: editingCustomer.pricePerCan || 1,
        notes: editingCustomer.notes || "",
      });

      const fetchCustomerStats = async () => {
        if (!editingCustomer._id && !editingCustomer.customerId) {
          console.log('No customer ID available for stats');
          return;
        }
        setIsLoadingStats(true);
        try {
          const customerId = editingCustomer._id || editingCustomer.customerId;
          console.log('=== CUSTOMER STATS DEBUG ===');
          console.log('Fetching stats for customer ID:', customerId);
          console.log('Customer ID type:', typeof customerId);
          console.log('Full customer object:', editingCustomer);
          
          const statsUrl = `http://localhost:4000/api/customers/${customerId}/stats`;
          console.log('Stats URL:', statsUrl);
          
          const response = await fetch(statsUrl);
          console.log('Customer stats response status:', response.status);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (response.ok) {
            const stats = await response.json();
            console.log('Customer stats received:', stats);
            console.log('Setting totalOrders to:', stats.totalDeliveries || 0);
            console.log('Setting totalCansReceived to:', stats.totalCansReceived || 0);
            
            setTotalOrders(stats.totalDeliveries || 0);
            setTotalCansReceived(stats.totalCansReceived || 0);
            
            // Set up real-time updates for customer stats every 5 seconds
            if (!statsIntervalRef.current) {
              console.log('Setting up stats refresh interval');
              statsIntervalRef.current = setInterval(async () => {
                try {
                  const refreshResponse = await fetch(statsUrl);
                  if (refreshResponse.ok) {
                    const refreshStats = await refreshResponse.json();
                    console.log('Stats refresh:', refreshStats);
                    setTotalOrders(refreshStats.totalDeliveries || 0);
                    setTotalCansReceived(refreshStats.totalCansReceived || 0);
                  }
                } catch (error) {
                  console.log('Stats refresh error (silent):', error);
                }
              }, 5000);
            }
          } else {
            const errorText = await response.text();
            console.error('Failed to fetch customer stats:', response.status, errorText);
            setTotalOrders(0);
            setTotalCansReceived(0);
          }
        } catch (error) {
          console.error("Error fetching customer stats:", error);
          setTotalOrders(0);
          setTotalCansReceived(0);
          toast({ variant: "destructive", title: "Failed to load customer stats." });
        } finally {
          setIsLoadingStats(false);
        }
      };
      fetchCustomerStats();

      // Cleanup interval when component unmounts or customer changes
      return () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
      };

    } else {
      form.reset({
        name: "",
        phone: "",
        address: "",
        defaultCans: 1,
        pricePerCan: 1, // Set to minimum allowed value
        notes: "",
      });
      setTotalOrders(null);
      setTotalCansReceived(null);
    }
  }, [editingCustomer, form, isEditMode, toast]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    form.setValue("name", value);
    if (/[ء-ي]/.test(value) && !nameManuallySetRtl) {
      event.target.dir = 'rtl';
    } else if (!nameManuallySetRtl) {
      event.target.dir = 'ltr';
    }
  };

  const handleNameDirectionToggle = () => {
    const nameInput = document.getElementById('customerName') as HTMLInputElement;
    if (nameInput) {
      nameInput.dir = nameInput.dir === 'rtl' ? 'ltr' : 'rtl';
      setNameManuallySetRtl(true);
    }
  };

  const onSubmit = async (data: CustomerFormValues) => {
    setIsSubmitting(true);

    try {
      const customerDataToSave = {
        name: data.name.trim(),
        phone: data.phone?.trim() || "",
        address: data.address.trim(),
        defaultCans: Number(data.defaultCans) || 1,
        pricePerCan: Number(data.pricePerCan), // Remove the || 0 fallback
        notes: data.notes?.trim() || "",
      };

      console.log('Submitting customer data:', customerDataToSave);

      if (isEditMode && (editingCustomer?._id || editingCustomer?.customerId)) {
        // Update existing customer
        const customerId = editingCustomer._id || editingCustomer.customerId;
        const response = await fetch(`http://localhost:4000/api/customers/${customerId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(customerDataToSave),
        });

        const result = await response.json();
        console.log('Update response:', result);

        if (!response.ok) {
          throw new Error(result.error || result.details || `HTTP error! status: ${response.status}`);
        }

        toast({
          title: "Customer Updated",
          description: `Customer "${result.name}" updated successfully.`,
        });
      } else {
        // Add new customer
        const response = await fetch('http://localhost:4000/api/customers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(customerDataToSave),
        });

        const result = await response.json();
        console.log('Add response:', result);

        if (!response.ok) {
          throw new Error(result.error || result.details || `HTTP error! status: ${response.status}`);
        }

        toast({
          title: "Customer Added",
          description: `Customer "${result.name}" added successfully.`,
        });
      }
      
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast({
        variant: "destructive",
        title: `Failed to ${isEditMode ? 'Update' : 'Add'} Customer`,
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> {/* Reduced space-y from 6 to 4 */}
        
        {isEditMode && (
          <Card className="mb-6 glass-card">
            <CardHeader>
              <CardTitle>Customer Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Deliveries</p>
                    <p className="text-2xl font-bold text-primary">{totalOrders ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cans Received</p>
                    <p className="text-2xl font-bold text-blue-600">{totalCansReceived ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price per Can</p>
                    <p className="text-lg font-semibold text-green-600">Rs. {editingCustomer?.pricePerCan || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bill</p>
                    <p className="text-2xl font-bold text-green-700">
                      Rs. {((totalCansReceived || 0) * (editingCustomer?.pricePerCan || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    id="customerName"
                    placeholder="e.g., سهيل احمد عباسي or Suhail Ahmed Abbasi"
                    {...field}
                    onChange={(e) => {
                        field.onChange(e);
                        handleNameChange(e);
                    }}
                    className="font-sindhi"
                  />
                </FormControl>
                <Button type="button" variant="outline" size="sm" onClick={handleNameDirectionToggle} className="px-2 py-1 text-xs">
                  Toggle RTL
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+923337860444" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Full address for delivery" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Profile Picture Field Removed */}

        <FormField
          control={form.control}
          name="defaultCans"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Number of Cans</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pricePerCan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price per Can (Rs.) *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter price (1-999)" 
                  min="1"
                  max="999"
                  step="1"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (Number(value) > 0 && Number(value) <= 999 && value.length <= 3)) {
                      field.onChange(value);
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any special instructions or notes about the customer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? (isEditMode ? "Updating..." : "Adding...") : (isEditMode ? "Update Customer" : "Add Customer")}
        </Button>
      </form>
    </Form>
  );
}

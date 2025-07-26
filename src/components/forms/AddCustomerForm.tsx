
"use client";

import React, { useState } from 'react';
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

const addCustomerSchema = z.object({
  name: z.string().min(1, { message: "Customer name is required." }),
  phone: z.string().optional(),
  address: z.string().min(1, { message: "Address is required." }),
  defaultCans: z.coerce.number().min(0, { message: "Default cans cannot be negative." }).default(1),
  pricePerCan: z.coerce.number().min(1, { message: "Price per can is required and must be greater than 0." }).max(999, { message: "Price cannot exceed 999." }),
  notes: z.string().optional(),
});

type AddCustomerFormValues = z.infer<typeof addCustomerSchema>;

interface AddCustomerFormProps {
  onSuccess?: () => void;
}

export default function AddCustomerForm({ onSuccess }: AddCustomerFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameManuallySetRtl, setNameManuallySetRtl] = useState(false);

  const form = useForm<AddCustomerFormValues>({
    resolver: zodResolver(addCustomerSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      defaultCans: 1,
      pricePerCan: 1, // Set to minimum allowed value
      notes: "",
    },
  });

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

  const onSubmit = async (data: AddCustomerFormValues) => {
    setIsSubmitting(true);

    try {
      const customerData = {
        name: data.name.trim(),
        phone: data.phone?.trim() || "",
        address: data.address.trim(),
        defaultCans: Number(data.defaultCans) || 1,
        pricePerCan: Number(data.pricePerCan), // Remove the || 0 fallback
        notes: data.notes?.trim() || "",
      };

      console.log('Submitting customer data:', customerData);

      const response = await fetch('http://localhost:4000/api/customers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(customerData),
      });

      const result = await response.json();
      console.log('Backend response status:', response.status);
      console.log('Backend response:', result);

      if (!response.ok) {
        throw new Error(result.error || result.details || `HTTP error! status: ${response.status}`);
      }

      // Reset form and trigger success callback
              form.reset({
          name: "",
          phone: "",
          address: "",
          defaultCans: 1,
          pricePerCan: 1, // Set to minimum allowed value
          notes: "",
        });

      toast({
        title: "Customer Added",
        description: `Customer "${result.name}" added successfully.`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error adding customer:", error);
      toast({
        variant: "destructive",
        title: "Failed to Add Customer",
        description: error.message || "An unexpected error occurred while saving.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          {isSubmitting ? "Adding Customer..." : "Add Customer"}
        </Button>
      </form>
    </Form>
  );
}

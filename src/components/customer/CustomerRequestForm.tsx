"use client";

/**
 * Customer Request Form Component
 * 
 * Simplified form for customers to create delivery requests
 * Pre-filled with customer information
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus } from 'lucide-react';
import type { Customer } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';

const requestSchema = z.object({
  cans: z.number().min(1, { message: "At least 1 can is required." }),
  orderDetails: z.string().optional(),
  priority: z.enum(['normal', 'urgent']),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface CustomerRequestFormProps {
  customer: Customer;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CustomerRequestForm({
  customer,
  onSuccess,
  onClose
}: CustomerRequestFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      cans: 1,
      orderDetails: "",
      priority: "normal",
    },
  });

  const onSubmit = async (data: RequestFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cans: data.cans,
          orderDetails: data.orderDetails || "",
          priority: data.priority,
          customerId: customer._id || (customer as any).customerId,
          customerIntId: (customer as any).id,
          customerName: customer.name,
          address: customer.address,
          pricePerCan: (customer as any)?.pricePerCan || 0,
          paymentType: (customer as any)?.paymentType || 'cash',
          createdBy: 'customer_portal',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create request');
      }

      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast({
        variant: "destructive",
        title: "Failed to Create Request",
        description: error.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">Customer Information</p>
            <p className="text-sm text-muted-foreground">{customer.name}</p>
            <p className="text-sm text-muted-foreground">{customer.address}</p>
            {(customer as any).id && (
              <p className="text-sm text-muted-foreground">ID: {(customer as any).id}</p>
            )}
          </div>

          <FormField
            control={form.control}
            name="cans"
            render={({ field }) => {
              const currentValue = Number(field.value) || 1;
              
              const handleDecrement = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                e.stopPropagation();
                const value = Number(field.value) || 1;
                if (value > 1) {
                  field.onChange(value - 1);
                }
              };
              
              const handleIncrement = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                e.stopPropagation();
                const value = Number(field.value) || 1;
                field.onChange(value + 1);
              };
              
              return (
                <FormItem>
                  <FormLabel>Number of Cans</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleDecrement}
                        disabled={currentValue <= 1}
                        className="h-10 w-10 border-2 border-primary/30 hover:border-primary disabled:opacity-50"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-2xl font-semibold text-foreground">{currentValue}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleIncrement}
                        className="h-10 w-10 border-2 border-primary/30 hover:border-primary"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white border-2 border-primary/30 focus:border-primary">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Special Instructions (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Any special instructions or notes..."
                    className="bg-white border-2 border-primary/30 focus:border-primary min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-primary via-accent to-primary hover:from-primary hover:via-accent hover:to-primary transition-all duration-300"
            style={{ backgroundSize: '200% auto' }}
          >
            {isSubmitting ? "Creating..." : "Create Request"}
          </Button>
        </div>
      </form>
    </Form>
  );
}


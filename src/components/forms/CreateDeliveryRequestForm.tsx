"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle, Ban, Plus, Minus } from "lucide-react";
import type { Customer, DeliveryRequest } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildApiUrl, API_ENDPOINTS } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const createDeliveryRequestSchema = z.object({
  cans: z.coerce.number().min(1, { message: "Number of cans must be at least 1." }),
  orderDetails: z.string().optional(),
  priority: z.enum(["normal", "urgent"], { required_error: "Priority is required." })
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
  editingRequest
}: CreateDeliveryRequestFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
  const [customersWithActiveRequests, setCustomersWithActiveRequests] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = !!editingRequest;
  const canCancelRequest =
    isEditMode &&
    editingRequest &&
    ["pending", "pending_confirmation", "processing"].includes(editingRequest.status);

  const form = useForm<CreateDeliveryRequestFormValues>({
    resolver: zodResolver(createDeliveryRequestSchema),
    defaultValues: {
      cans: editingRequest?.cans || customerToPreselect?.defaultCans || 1,
      orderDetails: editingRequest?.orderDetails || "",
      priority: editingRequest?.priority || "normal"
    }
  });

  useEffect(() => {
    if (editingRequest) {
      const customerForEdit: Customer = {
        _id: (editingRequest as any).customerId?._id,
        id: editingRequest.customerIntId,
        customerId: editingRequest.customerId,
        name: editingRequest.customerName,
        address: editingRequest.address,
        defaultCans: editingRequest.cans,
        pricePerCan: (editingRequest as any).pricePerCan,
        notes: "",
        phone: "",
        createdAt: "",
        updatedAt: "",
        paymentType: (editingRequest as any).paymentType
      };
      setSelectedCustomer(customerForEdit);
      form.reset({
        cans: editingRequest.cans,
        orderDetails: editingRequest.orderDetails || "",
        priority: editingRequest.priority
      });
      setIsLoadingCustomers(false);
    } else if (customerToPreselect) {
      const ensured: Customer = {
        ...(customerToPreselect as any),
        id: (customerToPreselect as any).id ?? 0
      } as Customer;
      setSelectedCustomer(ensured);
      form.reset({
        cans: customerToPreselect.defaultCans || 1,
        orderDetails: "",
        priority: "normal"
      });
      setIsLoadingCustomers(false);
    } else {
      const fetchCustomersAndActiveRequests = async () => {
        setIsLoadingCustomers(true);
        try {
          const customersResponse = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS));
          if (!customersResponse.ok) throw new Error(`HTTP error! status: ${customersResponse.status}`);
          const customersData = await customersResponse.json();
          setAllCustomers(customersData);

          const requestsResponse = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS));
          if (requestsResponse.ok) {
            const requestsData: DeliveryRequest[] = await requestsResponse.json();
            const activeCustomerIds = new Set<string>();
            requestsData
              .filter(req =>
                ["pending", "pending_confirmation", "processing"].includes(req.status)
              )
              .forEach(req => {
                if (req.customerIntId != null) {
                  activeCustomerIds.add(String(req.customerIntId));
                }
              });
            setCustomersWithActiveRequests(activeCustomerIds);
          }
        } catch (error) {
          console.error("Error fetching customers:", error);
          toast({
            variant: "destructive",
            title: "Failed to load customers",
            description: "Could not fetch customer list for selection."
          });
          setAllCustomers([]);
        } finally {
          setIsLoadingCustomers(false);
        }
      };
      fetchCustomersAndActiveRequests();
    }
  }, [toast, form, customerToPreselect, editingRequest]);

  const filteredCustomers = useMemo(() => {
    if (isEditMode || customerToPreselect) return [];
    if (!searchTerm.trim()) return [];
    return allCustomers.filter(customer => {
      const searchLower = searchTerm.toLowerCase().trim();
      if (customersWithActiveRequests.has(String(customer.id))) return false;
      return (
        customer.name.toLowerCase().includes(searchLower) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        customer.address.toLowerCase().includes(searchLower)
      );
    });
  }, [allCustomers, searchTerm, customerToPreselect, isEditMode, customersWithActiveRequests]);

  const handleSelectCustomer = (customer: Customer) => {
    const hasActiveRequest = customersWithActiveRequests.has(String(customer.id));
    if (hasActiveRequest) {
      toast({
        variant: "destructive",
        title: "Active Request Exists",
        description: `${customer.name} already has an active delivery request.`
      });
      return;
    }
    setSelectedCustomer(customer);
    form.setValue("cans", customer.defaultCans || 1);
  };

  const onSubmit = async (data: CreateDeliveryRequestFormValues) => {
    if (!selectedCustomer && !isEditMode) {
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please search and select a customer."
      });
      return;
    }
    setIsSubmitting(true);

    // Instant block to remove from search immediately
    if (!isEditMode && selectedCustomer) {
      setCustomersWithActiveRequests(prev => {
        const updated = new Set(prev);
        updated.add(String(selectedCustomer.id));
        return updated;
      });
    }

    try {
      if (isEditMode && editingRequest) {
        await fetch(buildApiUrl(`api/delivery-requests/${editingRequest._id || editingRequest.requestId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            customerIntId: editingRequest.customerIntId,
            customerName: editingRequest.customerName,
            address: editingRequest.address,
            pricePerCan: (editingRequest as any)?.pricePerCan,
            paymentType: (editingRequest as any)?.paymentType
          })
        });
      } else if (selectedCustomer) {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            customerIntId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            address: selectedCustomer.address,
            pricePerCan: (selectedCustomer as any)?.pricePerCan,
            paymentType: (selectedCustomer as any)?.paymentType || "cash"
          })
        });
        if (!res.ok) throw new Error("Failed to create request");
      }
      form.reset();
      setSelectedCustomer(null);
      if (onSuccess) onSuccess();
      if (onCloseDialog) onCloseDialog();
    } catch (error: any) {
      console.error("Error submitting delivery request:", error);
      if (!isEditMode && selectedCustomer) {
        // rollback if failed
        setCustomersWithActiveRequests(prev => {
          const updated = new Set(prev);
          updated.delete(String(selectedCustomer.id));
          return updated;
        });
      }
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "An unexpected error occurred."
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
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoadingCustomers || isSubmitting}
              />
            </div>
            {filteredCustomers.length > 0 && (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredCustomers.map(customer => (
                    <Button
                      key={customer.id}
                      type="button"
                      variant="ghost"
                      className="w-full justify-start h-auto p-2 text-left"
                      onClick={() => handleSelectCustomer(customer)}
                      disabled={isSubmitting}
                    >
                      <Avatar className="h-8 w-8 mr-3">
                        <AvatarFallback>
                          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{customer.id} - {customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.address}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : null}

        <fieldset disabled={(!selectedCustomer && !isEditMode) || isSubmitting} className="space-y-6">
          <FormField
            control={form.control}
            name="cans"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Cans</FormLabel>
                <FormControl>
                  <Input type="number" {...field} min={1} />
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
                <FormLabel>Order Details / Customer Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="normal" />
                      </FormControl>
                      <FormLabel>Normal</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="urgent" />
                      </FormControl>
                      <FormLabel>Urgent</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {canCancelRequest && (
            <AlertDialog open={isCancelConfirmationOpen} onOpenChange={setIsCancelConfirmationOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isSubmitting}>
                  <Ban className="mr-2 h-4 w-4" /> Cancel Delivery
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this request for {editingRequest?.customerName}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>Dismiss</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {}} disabled={isSubmitting}>
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="button" variant="outline" onClick={onCloseDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={(!selectedCustomer && !isEditMode) || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditMode ? "Update Request" : "Create Request"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

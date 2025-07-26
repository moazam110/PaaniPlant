
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import type { Customer, DeliveryRequest } from '@/types';
// REMOVE: import { db } from '@/lib/firebase';
// REMOVE: import { collection, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
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
import { Search, AlertTriangle, PlusCircle, Pencil, CheckCircle, XCircle, Ban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
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


interface DeliveryRequestListProps {
  onInitiateNewRequest: (customer: Customer) => void;
  onEditRequest: (request: DeliveryRequest) => void;
  deliveryRequests: DeliveryRequest[];
  setDeliveryRequests: React.Dispatch<React.SetStateAction<DeliveryRequest[]>>;
}

const DeliveryRequestList: React.FC<DeliveryRequestListProps> = ({ onInitiateNewRequest, onEditRequest, deliveryRequests, setDeliveryRequests }) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();


  useEffect(() => {
    setIsLoadingCustomers(true);
    fetch('http://localhost:4000/api/customers')
      .then(res => res.json())
      .then((data) => {
        setAllCustomers(data);
        setIsLoadingCustomers(false);
        setError(null);
      })
      .catch((err) => {
        setError('Failed to fetch customers.');
        setIsLoadingCustomers(false);
      });
  }, []);

  const processedRequests = useMemo(() => {
    // Client-side sort to ensure 'pending' and 'pending_confirmation' are on top,
    // then 'delivered', then 'cancelled'. Within these groups, rely on Firestore's 'requestedAt' (desc)
    // and 'priority' (desc for emergencies within pending).
    return [...deliveryRequests].sort((a, b) => {
        const statusOrderValue = (status: DeliveryRequest['status']) => {
            if (status === 'pending_confirmation') return 0; // Urgent might make this appear above regular pending
            if (status === 'pending') return 1;
            if (status === 'processing') return 2; // Added processing status
            if (status === 'delivered') return 3;
            if (status === 'cancelled') return 4;
            return 5; 
        };

        const orderA = statusOrderValue(a.status);
        const orderB = statusOrderValue(b.status);

        if (orderA !== orderB) return orderA - orderB;

        // Within the same status group, if it's an active request, prioritize urgent
        if (a.status === 'pending' || a.status === 'pending_confirmation' || a.status === 'processing') {
            if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
            if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
        }
        
        // If statuses and (for active) priorities are the same, rely on Firestore's requestedAt (desc)
        // This means timeB - timeA to keep recent on top.
        const timeA = new Date(a.requestedAt).getTime();
        const timeB = new Date(b.requestedAt).getTime();
        return timeB - timeA;
    });
  }, [deliveryRequests]);


  const filteredDeliveryRequests = useMemo(() => {
    if (!searchTerm) {
      return processedRequests;
    }
    
    // Standard search method - focus on customer name with character-by-character matching
    return processedRequests.filter(request => {
      const searchLower = searchTerm.toLowerCase().trim();
      const customerNameLower = request.customerName.toLowerCase();
      
      // Primary search: customer name (same standard as other components)
      const matchesCustomerName = customerNameLower.includes(searchLower);
      
      // Secondary searches: address, status, priority (for admin convenience)
      const matchesAddress = request.address.toLowerCase().includes(searchLower);
      const statusDisplay = request.status === 'pending' ? 'pending' : request.status;
      const matchesStatus = statusDisplay.toLowerCase().includes(searchLower);
      const matchesPriority = request.priority.toLowerCase().includes(searchLower);
      
      // Standard search prioritizes customer name, but includes other fields for admin use
      return matchesCustomerName || matchesAddress || matchesStatus || matchesPriority;
    });
  }, [processedRequests, searchTerm]);

  const customersForNewRequest = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const searchLower = searchTerm.toLowerCase().trim();
    // Include processing status in active requests check
    const customersWithActiveRequests = new Set(
      deliveryRequests
        .filter(req => ['pending', 'pending_confirmation', 'processing'].includes(req.status))
        .map(req => req.customerId)
    );

    return allCustomers
      .filter(customer => {
        // Standard search: exact same method as CreateDeliveryRequestForm
        const nameLower = customer.name.toLowerCase();
        const matchesSearch = nameLower.includes(searchLower) ||
                             (customer.phone && customer.phone.includes(searchTerm)) ||
                             customer.address.toLowerCase().includes(searchLower);
        
        // Only show customers without active requests
        const hasNoActiveRequest = !customersWithActiveRequests.has(customer._id || customer.customerId || '');
        
        return matchesSearch && hasNoActiveRequest;
      })
      .slice(0, 8); // Show more results for better UX
  }, [allCustomers, deliveryRequests, searchTerm]);


  const getStatusBadgeVariant = (status: DeliveryRequest['status']) => {
    switch (status) {
      case 'pending': return 'default'; 
      case 'pending_confirmation': return 'secondary';
      case 'processing': return 'default'; // Added processing variant
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

  const isLoading = false; // No longer loading mock data

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
    <div className="mt-4 space-y-6">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search requests or find customers for new request..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full "
        />
      </div>

      {/* Customer suggestions for new request on TOP */}
      {searchTerm && customersForNewRequest.length > 0 && (
          <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Create New Request for:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customersForNewRequest.map(customer => (
                  <Card key={customer._id || customer.customerId || `customer-${Math.random()}`} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex justify-between items-center">
                          <div>
                              <p className={cn("font-medium", /[ء-ي]/.test(customer.name) ? 'font-sindhi rtl' : 'ltr')}>{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.address}</p>
                          </div>
                          <Button size="sm" onClick={() => onInitiateNewRequest(customer)}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Create Request
                          </Button>
                      </CardContent>
                  </Card>
              ))}
              </div>
          </div>
      )}

      {filteredDeliveryRequests.length === 0 && !searchTerm && (
         <p className="text-muted-foreground mt-4 text-center">No delivery requests. Use search to find customers for new requests.</p>
      )}
      {filteredDeliveryRequests.length === 0 && searchTerm && customersForNewRequest.length === 0 && (
         <p className="text-muted-foreground mt-4 text-center">No requests or customers found matching "{searchTerm}".</p>
      )}

      {filteredDeliveryRequests.length > 0 && (
        <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-center">Cans</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveryRequests.map((request) => {
                const isSindhiName = /[ء-ي]/.test(request.customerName);
                const nameClasses = cn(isSindhiName ? 'font-sindhi rtl' : 'ltr');
                const isCancelled = request.status === 'cancelled';
                const isDelivered = request.status === 'delivered';
                const rowClasses = cn(
                    isCancelled ? 'opacity-60 bg-muted/30' : '',
                    isDelivered ? 'bg-green-500/10' : '',
                    request.status === 'processing' ? 'bg-yellow-100' : ''
                );
                
                // Requests can be edited if they are not delivered or cancelled.
                // const canBeEdited = request.status !== 'delivered' && request.status !== 'cancelled';
                // All requests can be "edited" to view details or potentially cancel if pending/pending_confirmation.
                // The form itself will handle if cancellation is possible.

                return (
                  <TableRow key={request._id || request.requestId || `req-${Math.random()}`} className={rowClasses}>
                    <TableCell className={cn(nameClasses, isCancelled && 'line-through')}>
                        {request.customerName}
                    </TableCell>
                    <TableCell className={cn("whitespace-normal break-words max-w-xs", isCancelled && 'line-through')}>
                        {request.address}
                    </TableCell>
                    <TableCell className={cn("text-center", isCancelled && 'line-through')}>{request.cans}</TableCell>
                    <TableCell className={isCancelled ? 'line-through' : ''}>
                      {getPriorityIcon(request.priority)}
                      <span className="capitalize">{request.priority}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                        {getStatusIcon(request.status)}
                        {getStatusDisplay(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className={isCancelled ? 'line-through' : ''}>
                      {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                       {/* Always show Edit button, form will handle context (new/edit/cancel) */}
                        <Button variant="ghost" size="icon" title="Edit/View Request" onClick={() => onEditRequest(request)}>
                            <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
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
};

export default DeliveryRequestList;

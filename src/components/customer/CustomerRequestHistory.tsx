"use client";

/**
 * Customer Request History Component
 * 
 * Displays customer's delivery request history in a table format
 * Shows status, date, cans, priority, etc.
 * Mobile responsive: Shows Date, Cans, Status, Created By in portrait mode
 * Shows all columns in landscape mode
 */

import React, { useState, useEffect } from 'react';
import type { DeliveryRequest, Customer } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerRequestHistoryProps {
  requests: DeliveryRequest[];
  customer: Customer;
}

// Match admin dashboard status badge variants exactly
const getStatusBadgeVariant = (status: DeliveryRequest['status']) => {
  switch (status) {
    case 'pending': return 'default'; 
    case 'pending_confirmation': return 'secondary';
    case 'processing': return 'default';
    case 'delivered': return 'outline'; 
    case 'cancelled': return 'destructive';
    default: return 'default';
  }
};

const getStatusDisplay = (status: DeliveryRequest['status']) => {
  if (status === 'pending') return 'Pending';
  return status.replace('_', ' ');
};

const getStatusIcon = (status: DeliveryRequest['status']) => {
  if (status === 'delivered') return <CheckCircle className="h-4 w-4 text-green-600 inline-block mr-1" />;
  if (status === 'cancelled') return <XCircle className="h-4 w-4 text-destructive inline-block mr-1" />;
  return null;
};

const getStatusBadge = (status: DeliveryRequest['status']) => {
  return (
    <Badge variant={getStatusBadgeVariant(status)} className="capitalize">
      {getStatusIcon(status)}
      {getStatusDisplay(status)}
    </Badge>
  );
};

const getCancellationReasonLabel = (reason?: string) => {
  const labels: Record<string, string> = {
    door_closed: 'Door Closed',
    duplicate: 'Duplicate',
    other: 'Other',
    not_needed_today: 'Not Needed Today',
    ordered_by_mistake: 'Ordered by Mistake',
    system_problem: 'System Problem',
    area_not_reachable: 'Area Not Reachable',
    bad_weather: 'Bad Weather',
    no_stock_available: 'No Stock Available',
  };
  return reason ? (labels[reason] || reason) : null;
};

const getPriorityBadge = (priority: DeliveryRequest['priority']) => {
  return (
    <Badge variant={priority === 'urgent' ? "destructive" : "outline"}>
      {priority === 'urgent' ? 'Urgent' : 'Normal'}
    </Badge>
  );
};

export default function CustomerRequestHistory({
  requests,
  customer
}: CustomerRequestHistoryProps) {
  // Detect screen orientation (portrait vs landscape)
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check if screen is in portrait mode (height > width)
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    // Check on mount and on resize/orientation change
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return (
    <Card className="glass-card border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Package className="h-4 w-4 sm:h-5 sm:w-5" />
          Your Request History
          <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-2">
            ({requests.length} {requests.length === 1 ? 'request' : 'requests'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        {requests.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-base sm:text-lg font-medium mb-2">No requests found</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {requests.length === 0 && "Create your first delivery request to get started!"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Date</TableHead>
                  <TableHead className="text-xs sm:text-sm">Cans</TableHead>
                  {/* Hide Priority, Price, Payment in portrait mode */}
                  <TableHead className={cn("text-xs sm:text-sm", isPortrait && "hidden")}>Priority</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className={cn("text-xs sm:text-sm", isPortrait && "hidden")}>Price</TableHead>
                  <TableHead className={cn("text-xs sm:text-sm", isPortrait && "hidden")}>Payment</TableHead>
                  <TableHead className="text-xs sm:text-sm">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const requestDate = request.requestedAt
                    ? format(new Date(request.requestedAt), isPortrait ? "MMM dd, yyyy" : "MMM dd, yyyy HH:mm")
                    : "N/A";
                  
                  const price = (request.pricePerCan || 0) * (request.cans || 0);
                  
                  // Match admin dashboard row styling
                  const isCancelled = request.status === 'cancelled';
                  const isDelivered = request.status === 'delivered';
                  const rowClasses = cn(
                    isCancelled ? 'opacity-60 bg-muted/30' : '',
                    isDelivered ? 'bg-green-500/10' : '',
                    request.status === 'processing' ? 'bg-yellow-100' : ''
                  );
                  
                  return (
                    <TableRow key={request._id || request.requestId} className={rowClasses}>
                      <TableCell className={cn("text-xs sm:text-sm font-medium", isCancelled ? 'line-through' : '')}>{requestDate}</TableCell>
                      <TableCell className={cn("text-xs sm:text-sm", isCancelled ? 'line-through' : '')}>{request.cans || 0}</TableCell>
                      {/* Hide Priority, Price, Payment in portrait mode */}
                      <TableCell className={cn(isPortrait && "hidden")}>
                        {getPriorityBadge(request.priority)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {getStatusBadge(request.status)}
                        {isCancelled && getCancellationReasonLabel((request as any).cancellationReason) && (
                          <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                            {getCancellationReasonLabel((request as any).cancellationReason)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-xs sm:text-sm", isCancelled ? 'line-through' : '', isPortrait && "hidden")}>
                        Rs. {price.toFixed(0)}
                      </TableCell>
                      <TableCell className={cn(isPortrait && "hidden")}>
                        <Badge variant="outline" className="text-xs">
                          {request.paymentType === 'account' ? 'Account' : 'Cash'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {(() => {
                          // Determine if created by customer or admin
                          // Only show "Customer" if explicitly set to 'customer_portal'
                          // Empty/null/other values default to "Admin" (for backward compatibility with old requests)
                          const isCustomerCreated = request.createdBy === 'customer_portal';
                          return (
                            <Badge variant={isCustomerCreated ? "secondary" : "default"} className="text-xs">
                              {isCustomerCreated ? 'Customer' : 'Admin'}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


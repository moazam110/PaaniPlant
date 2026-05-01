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
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerRequestHistoryProps {
  requests: DeliveryRequest[];
  customer: Customer;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

// Match admin dashboard status badge variants exactly
const getStatusBadgeVariant = (status: DeliveryRequest['status']) => {
  switch (status) {
    case 'pending': return 'default'; 
    case 'pending_confirmation': return 'secondary';
    case 'processing': return 'default';
    case 'delivered': return 'outline'; 
    case 'cancelled': return 'outline';
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

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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
  customer,
  hasMore,
  isLoadingMore,
  onLoadMore,
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
    <div>
      {requests.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-primary/40 mb-4 drop-shadow" />
          <p className="text-base sm:text-lg font-medium mb-2">No requests found</p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Create your first delivery request to get started!
          </p>
        </div>
      ) : (
        <div className="glass-table overflow-x-auto [&_th]:!px-1 [&_td]:!px-1 [&_th:first-child]:!pl-2 [&_td:first-child]:!pl-2 [&_th:last-child]:!pr-2 [&_td:last-child]:!pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70">Date</TableHead>
                  <TableHead className="text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center">Cans</TableHead>
                  {/* Hide Priority, Price, Payment in portrait mode */}
                  <TableHead className={cn("text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center", isPortrait && "hidden")}>Priority</TableHead>
                  <TableHead className="text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center">Status</TableHead>
                  <TableHead className={cn("text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-right", isPortrait && "hidden")}>Price/Can</TableHead>
                  <TableHead className={cn("text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center", isPortrait && "hidden")}>Payment</TableHead>
                  <TableHead className={cn("text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center", isPortrait && "hidden")}>Time</TableHead>
                  <TableHead className="text-[11px] sm:text-xs font-bold tracking-wide uppercase text-primary/70 text-center">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const requestDate = request.requestedAt
                    ? format(new Date(request.requestedAt), isPortrait ? "d MMM yy" : "d MMM yyyy, HH:mm")
                    : "N/A";
                  
                  const price = request.pricePerCan || 0;
                  
                  // Match admin dashboard row styling
                  const isCancelled = request.status === 'cancelled';
                  const isDelivered = request.status === 'delivered';
                  const rowClasses = cn(
                    isCancelled ? 'opacity-55 bg-muted/20' : '',
                    isDelivered ? 'bg-green-500/12' : '',
                    request.status === 'processing' ? 'bg-amber-400/15' : '',
                    request.status === 'pending' || request.status === 'pending_confirmation' ? 'bg-primary/5' : ''
                  );
                  
                  return (
                    <TableRow key={request._id || request.requestId} className={rowClasses}>
                      <TableCell className={cn(
                        "whitespace-nowrap text-[11px] sm:text-xs font-semibold tracking-tight",
                        isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
                      )}>{requestDate}</TableCell>
                      <TableCell className={cn(
                        "text-center text-sm font-black",
                        isCancelled ? 'line-through text-muted-foreground' : 'text-primary/80'
                      )}>{request.cans || 0}</TableCell>
                      {/* Hide Priority, Price, Payment in portrait mode */}
                      <TableCell className={cn("text-center", isPortrait && "hidden")}>
                        {getPriorityBadge(request.priority)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(request.status)}
                        {isCancelled && getCancellationReasonLabel((request as any).cancellationReason) && (
                          <div className="text-[10px] text-muted-foreground mt-1 leading-tight text-center">
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
                      <TableCell className={cn(isPortrait && "hidden")}>
                        {(() => {
                          const deliveredMs = (request as any).deliveredAt && request.requestedAt
                            ? new Date((request as any).deliveredAt).getTime() - new Date(request.requestedAt).getTime()
                            : 0;
                          const processingMs = (request as any).processingAt && request.requestedAt
                            ? new Date((request as any).processingAt).getTime() - new Date(request.requestedAt).getTime()
                            : 0;
                          return (
                            <div className="text-xs">
                              <div className="font-bold">{deliveredMs > 0 ? formatDuration(deliveredMs) : '—'}</div>
                              {processingMs > 0 && (
                                <div className="text-muted-foreground text-[10px]">{formatDuration(processingMs)}</div>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
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
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full sm:w-auto"
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}



import React, { useState, useMemo } from 'react';
import type { DeliveryRequest } from '@/types';
import RequestCard from './RequestCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListFilter, ListChecks, Clock } from 'lucide-react';

interface RequestQueueProps {
  requests: DeliveryRequest[];
  onMarkAsDone: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  addressSortOrder?: 'asc' | 'desc' | null;
}

const RequestQueue: React.FC<RequestQueueProps> = ({ requests, onMarkAsDone, onCancel, addressSortOrder }) => {
  const [expandedDelivered, setExpandedDelivered] = useState<Record<string, boolean>>({});
  
  const toggleDelivered = (key: string) => {
    setExpandedDelivered(prev => ({ ...prev, [key]: !prev?.[key] }));
  };
  
  // Memoized address comparison function
  const compareByAddress = (a: DeliveryRequest, b: DeliveryRequest, order: 'asc' | 'desc') => {
    const addrA = (a.address || '').toString().toLowerCase();
    const addrB = (b.address || '').toString().toLowerCase();
    const dir = order === 'asc' ? 1 : -1;
    
    if (addrA < addrB) return -1 * dir;
    if (addrA > addrB) return 1 * dir;
    
    // Tie-breaker: urgent first
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    
    // Final tie-breaker: time oldest first
    const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
    const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
    return timeA - timeB;
  };

  // Memoized request filtering and sorting
  const pendingRequests = useMemo(() => {
    return requests
      .filter(req => (req.status === 'pending' || req.status === 'pending_confirmation'))
      .sort((a, b) => {
        if (addressSortOrder) {
          return compareByAddress(a, b, addressSortOrder);
        }
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
        
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeA - timeB; // Oldest first
      });
  }, [requests, addressSortOrder]);

  const processingRequests = useMemo(() => {
    return requests
      .filter(req => req.status === 'processing')
      .sort((a, b) => {
        if (addressSortOrder) {
          return compareByAddress(a, b, addressSortOrder);
        }
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
        
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeA - timeB; // Oldest first
      });
  }, [requests, addressSortOrder]);

  const deliveredRequests = useMemo(() => {
    // Pre-compute date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return requests
      .filter(req => {
        if (req.status !== 'delivered') return false;
        
        // Use appropriate date field based on status
        let completionDate;
        completionDate = req.deliveredAt ? new Date(req.deliveredAt) : new Date(req.completedAt || req.requestedAt);
        
        return completionDate && completionDate >= today && completionDate < tomorrow;
      })
      .sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return timeB - timeA; // Newest completed first
      });
  }, [requests]);

  // Canceled requests are excluded entirely

  return (
    <div className="p-2 md:p-3 space-y-2">
      <Accordion type="multiple" defaultValue={['pending-requests', 'processing-requests', 'delivered-requests']} className="w-full">
        <AccordionItem value="pending-requests">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <div className="flex items-center">
              <ListFilter className="h-6 w-6 mr-3 text-primary" />
              Pending Requests ({pendingRequests.length}) 
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {pendingRequests.length > 0 ? (
              <div className="grid gap-1 md:grid-cols-3 lg:grid-cols-4 py-1">
                {pendingRequests.map(request => (
                  <RequestCard 
                    key={request._id || request.requestId || Math.random()} 
                    request={request} 
                    onMarkAsDone={onMarkAsDone} 
                    {...(onCancel && { onCancel })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-2">No pending delivery requests.</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="processing-requests">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <div className="flex items-center">
              <Clock className="h-6 w-6 mr-3 text-yellow-600" />
              Processing Requests ({processingRequests.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {processingRequests.length > 0 ? (
              <div className="grid gap-1 md:grid-cols-3 lg:grid-cols-4 py-1">
                {processingRequests.map(request => (
                  <RequestCard 
                    key={request._id || request.requestId || Math.random()} 
                    request={request} 
                    onMarkAsDone={onMarkAsDone} 
                    {...(onCancel && { onCancel })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-2">No requests currently being processed.</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="delivered-requests">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            <div className="flex items-center">
              <ListChecks className="h-6 w-6 mr-3 text-green-600" />
              Completed Requests ({deliveredRequests.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {deliveredRequests.length > 0 ? (
              <div className="grid gap-1 md:grid-cols-3 lg:grid-cols-4 py-1">
                {deliveredRequests.map(request => {
                  const key = String(request._id || request.requestId || Math.random());
                  const intId = (request as any).customerIntId;
                  const title = intId ? `${intId} - ${request.customerName}` : request.customerName;
                  const isOpen = !!expandedDelivered[key];
                  return (
                    <div key={key} className="border rounded-lg">
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1 hover:bg-muted/50 whitespace-nowrap overflow-hidden text-ellipsis text-sm"
                        onClick={() => toggleDelivered(key)}
                        aria-expanded={isOpen}
                        title={title}
                      >
                        {title}
                      </button>
                      {isOpen && (
                        <div className="p-1">
                          <RequestCard 
                            request={request} 
                            onMarkAsDone={onMarkAsDone} 
                            {...(onCancel && { onCancel })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-2">No completed delivery requests yet.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default RequestQueue;

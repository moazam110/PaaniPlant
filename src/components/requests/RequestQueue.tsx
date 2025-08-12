
import React, { useState } from 'react';
import type { DeliveryRequest } from '@/types';
import RequestCard from './RequestCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListFilter, ListChecks, Clock } from 'lucide-react';

interface RequestQueueProps {
  requests: DeliveryRequest[];
  onMarkAsDone: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}

const RequestQueue: React.FC<RequestQueueProps> = ({ requests, onMarkAsDone, onCancel }) => {
  const [expandedDelivered, setExpandedDelivered] = useState<Record<string, boolean>>({});
  const toggleDelivered = (key: string) => {
    setExpandedDelivered(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const pendingRequests = requests
    .filter(req => req.status === 'pending' || req.status === 'pending_confirmation')
    .sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      // Ensure dates are properly compared; assuming they are Date objects or numbers
      const timeA = a.requestedAt instanceof Date ? a.requestedAt.getTime() : (typeof a.requestedAt === 'number' ? a.requestedAt : 0);
      const timeB = b.requestedAt instanceof Date ? b.requestedAt.getTime() : (typeof b.requestedAt === 'number' ? b.requestedAt : 0);
      return timeA - timeB; // Oldest first
    });

  const processingRequests = requests
    .filter(req => req.status === 'processing')
    .sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      // Sort by when they started processing (requestedAt for now, could be a processingStartedAt field)
      const timeA = a.requestedAt instanceof Date ? a.requestedAt.getTime() : (typeof a.requestedAt === 'number' ? a.requestedAt : 0);
      const timeB = b.requestedAt instanceof Date ? b.requestedAt.getTime() : (typeof b.requestedAt === 'number' ? b.requestedAt : 0);
      return timeA - timeB; // Oldest first
    });

  const deliveredRequests = requests
    .filter(req => {
      // Include delivered requests only
      if (req.status !== 'delivered') return false;
      
      // Show delivered/cancelled requests from current date only (24 hours)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Use appropriate date field based on status
      let completionDate;
      completionDate = req.deliveredAt ? new Date(req.deliveredAt) : new Date(req.completedAt || req.requestedAt);
      
      return completionDate && completionDate >= today && completionDate < tomorrow;
    })
    // Ensure dates are properly compared for sorting completedAt
    .sort((a, b) => {
        const timeA = a.completedAt instanceof Date ? a.completedAt.getTime() : (typeof a.completedAt === 'number' ? a.completedAt : 0);
        const timeB = b.completedAt instanceof Date ? b.completedAt.getTime() : (typeof b.completedAt === 'number' ? b.completedAt : 0);
        return timeB - timeA; // Newest completed first
    });

  // Today's cancelled to append at end of processing
  const cancelledToday = requests
    .filter(req => req.status === 'cancelled')
    .filter(req => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const completionDate = req.cancelledAt ? new Date(req.cancelledAt) : new Date(req.completedAt || req.requestedAt);
      return completionDate && completionDate >= today && completionDate < tomorrow;
    })
    .sort((a, b) => {
      const timeA = a.completedAt instanceof Date ? a.completedAt.getTime() : (typeof a.completedAt === 'number' ? a.completedAt : 0);
      const timeB = b.completedAt instanceof Date ? b.completedAt.getTime() : (typeof b.completedAt === 'number' ? b.completedAt : 0);
      return timeA - timeB; // append in chronological order after processing
    });

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
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 py-1">
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
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 py-1">
                {processingRequests.map(request => (
                  <RequestCard 
                    key={request._id || request.requestId || Math.random()} 
                    request={request} 
                    onMarkAsDone={onMarkAsDone} 
                    {...(onCancel && { onCancel })}
                  />
                ))}
                {cancelledToday.map(request => (
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
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 py-1">
                {deliveredRequests.map(request => {
                  const key = String(request._id || request.requestId || Math.random());
                  const intId = (request as any).customerIntId;
                  const title = intId ? `${intId} - ${request.customerName}` : request.customerName;
                  const isOpen = !!expandedDelivered[key];
                  return (
                    <div key={key} className="border rounded-lg">
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 hover:bg-muted/50 whitespace-nowrap overflow-hidden text-ellipsis"
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

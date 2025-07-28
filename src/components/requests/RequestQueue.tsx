
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import RequestCard from './RequestCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListFilter, ListChecks, Clock } from 'lucide-react';

interface RequestQueueProps {
  requests: DeliveryRequest[];
  onMarkAsDone: (requestId: string) => void;
}

const RequestQueue: React.FC<RequestQueueProps> = ({ requests, onMarkAsDone }) => {
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
    .filter(req => req.status === 'delivered')
    // Ensure dates are properly compared for sorting completedAt
    .sort((a, b) => {
        const timeA = a.completedAt instanceof Date ? a.completedAt.getTime() : (typeof a.completedAt === 'number' ? a.completedAt : 0);
        const timeB = b.completedAt instanceof Date ? b.completedAt.getTime() : (typeof b.completedAt === 'number' ? b.completedAt : 0);
        return timeB - timeA; // Newest completed first
    });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Accordion type="multiple" defaultValue={['pending-requests', 'processing-requests', 'delivered-requests']} className="w-full">
        <AccordionItem value="pending-requests">
          <AccordionTrigger className="text-xl font-headline hover:no-underline">
            <div className="flex items-center">
              <ListFilter className="h-6 w-6 mr-3 text-primary" />
              Pending Requests ({pendingRequests.length}) 
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {pendingRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-4">
                {pendingRequests.map(request => (
                  <RequestCard key={request._id || request.requestId || Math.random()} request={request} onMarkAsDone={onMarkAsDone} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No pending delivery requests.</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="processing-requests">
          <AccordionTrigger className="text-xl font-headline hover:no-underline">
            <div className="flex items-center">
              <Clock className="h-6 w-6 mr-3 text-yellow-600" />
              Processing Requests ({processingRequests.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {processingRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-4">
                {processingRequests.map(request => (
                  <RequestCard key={request._id || request.requestId || Math.random()} request={request} onMarkAsDone={onMarkAsDone} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No requests currently being processed.</p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="delivered-requests">
          <AccordionTrigger className="text-xl font-headline hover:no-underline">
            <div className="flex items-center">
              <ListChecks className="h-6 w-6 mr-3 text-green-600" />
              Delivered Requests ({deliveredRequests.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {deliveredRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-4">
                {deliveredRequests.map(request => (
                  <RequestCard key={request._id || request.requestId || Math.random()} request={request} onMarkAsDone={onMarkAsDone} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No delivered delivery requests yet.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default RequestQueue;

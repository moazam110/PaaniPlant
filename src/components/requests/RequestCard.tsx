
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, CalendarDays, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RequestCardProps {
  request: DeliveryRequest;
  onMarkAsDone: (requestId: string) => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onMarkAsDone }) => {
  const isUrgent = request.priority === 'urgent';
  const isSindhiName = /[ء-ي]/.test(request.customerName); 

  // Check for 'pending' or 'pending_confirmation' status
  const isPending = request.status === 'pending' || request.status === 'pending_confirmation';
  const isProcessing = request.status === 'processing';
  const isDelivered = request.status === 'delivered';

  const cardClasses = cn(
    'shadow-lg transition-all duration-300 ease-in-out',
    isDelivered ? 'opacity-70 border-green-500 bg-green-50' : '',
    isProcessing ? 'border-yellow-400 bg-yellow-50' : '',
    request.status === 'pending' || request.status === 'pending_confirmation' ? 'border-primary' : '',
    isUrgent && isPending ? 'border-destructive border-2' : ''
  );
  
  const customerNameClasses = cn(
    'font-headline',
    isSindhiName ? 'font-sindhi rtl' : 'ltr' 
  );

  return (
    <Card className={cardClasses}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={customerNameClasses}>
            {request.customerName}
          </CardTitle>
          {isDelivered ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : isProcessing ? (
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2" title="Processing" />
          ) : (
            <Truck className={cn("h-6 w-6", isUrgent ? "text-destructive" : "text-primary")} />
          )}
        </div>
        <CardDescription>{request.customerName}</CardDescription>
        {isProcessing && (
          <Badge className="mt-1 w-fit bg-yellow-400 text-yellow-900">Processing</Badge>
        )}
        {isDelivered && (
          <Badge className="mt-1 w-fit bg-green-500 text-white">Delivered</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xl font-bold text-primary">{request.cans} cans</p>
            {request.priority === 'urgent' && !isDelivered && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                URGENT
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{request.address}</p>
        </div>
        
        {request.orderDetails && (
          <p className="text-sm mb-3 p-2 bg-muted/50 rounded text-muted-foreground">
            {request.orderDetails}
          </p>
        )}
        
        <div className="flex items-center text-xs text-muted-foreground mb-1">
          <CalendarDays className="h-4 w-4 mr-2" />
          Requested: {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, yyyy HH:mm') : '-'}
        </div>
        {request.completedAt && (
          <div className="flex items-center text-xs text-green-600">
            <Check className="h-4 w-4 mr-2" />
            Completed: {format(new Date(request.completedAt), 'MMM d, yyyy HH:mm')}
          </div>
        )}
      </CardContent>
      <CardFooter>
        {isPending && (
          <Button 
            onClick={() => onMarkAsDone(request._id || request.requestId || '')}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900"
            aria-label={`Mark order for ${request.customerName} as processing`}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Processing
          </Button>
        )}
        {isProcessing && (
          <Button 
            onClick={() => onMarkAsDone(request._id || request.requestId || '')}
            className="w-full bg-green-500 hover:bg-green-400 text-white"
            aria-label={`Mark order for ${request.customerName} as delivered`}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Delivered
          </Button>
        )}
        {isDelivered && (
          <p className="text-sm text-green-600 font-medium w-full text-center">Delivery Fulfilled</p>
        )}
      </CardFooter>
    </Card>
  );
};

export default RequestCard;

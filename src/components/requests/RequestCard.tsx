
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, CalendarDays, Check, AlertTriangle, X, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RequestCardProps {
  request: DeliveryRequest;
  onMarkAsDone: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onMarkAsDone, onCancel }) => {
  const isUrgent = request.priority === 'urgent';
  const isSindhiName = /[ء-ي]/.test(request.customerName); 
  const intId = (request as any).customerIntId;
  const paymentType = ((request as any).paymentType || '').toString().toLowerCase();
  const pricePerCan = (request as any).pricePerCan;

  // Check for request statuses
  const isPending = request.status === 'pending' || request.status === 'pending_confirmation';
  const isProcessing = request.status === 'processing';
  const isDelivered = request.status === 'delivered';
  const isCancelled = request.status === 'cancelled';

  const cardClasses = cn(
    'shadow-md transition-all duration-300 ease-in-out',
    isDelivered ? 'opacity-70 border-green-500 bg-green-50' : '',
    isProcessing ? 'border-yellow-400 bg-yellow-50' : '',
    isCancelled ? 'opacity-70 border-red-500 bg-red-50' : '',
    request.status === 'pending' || request.status === 'pending_confirmation' ? 'border-primary' : '',
    isUrgent && isPending ? 'border-destructive border-2' : ''
  );
  
  const customerNameClasses = cn(
    'font-headline',
    isSindhiName ? 'font-sindhi rtl' : 'ltr' 
  );

  return (
    <Card className={cn(cardClasses, 'py-1 h-full flex flex-col')}>
      <CardHeader className="py-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className={cn(customerNameClasses, 'text-lg')}>
              <span className="text-base font-medium">{intId ? `${intId} - ${request.customerName}` : request.customerName}</span>
              {typeof pricePerCan === 'number' && pricePerCan >= 100 && (
                <span aria-label="Premium" className="inline-flex ml-2 align-middle">
                  <Star className="h-3 w-3 text-yellow-500" />
                </span>
              )}
            </CardTitle>
            {paymentType && (
              <div>
                <Badge variant="outline" className="text-[10px] py-0.5 px-2 capitalize">
                  {paymentType === 'account' ? 'Account' : 'Cash'}
                </Badge>
              </div>
            )}
          </div>
          {isDelivered ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : isCancelled ? (
            <X className="h-6 w-6 text-red-600" />
          ) : isProcessing ? (
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2" title="Processing" />
          ) : (
            <Truck className={cn("h-6 w-6", isUrgent ? "text-destructive" : "text-primary")} />
          )}
        </div>
        {isProcessing && (<Badge className="mt-1 w-fit bg-yellow-400 text-yellow-900 text-[10px] py-0.5 px-2">Processing</Badge>)}
        {isDelivered && (<Badge className="mt-1 w-fit bg-green-500 text-white text-[10px] py-0.5 px-2">Delivered</Badge>)}
        {isCancelled && (<Badge className="mt-1 w-fit bg-red-500 text-white text-[10px] py-0.5 px-2">Cancelled</Badge>)}
      </CardHeader>
      <CardContent className="py-2 flex-1">
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xl font-bold text-primary">{request.cans} cans</p>
            {request.priority === 'urgent' && !isDelivered && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                URGENT
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{request.address}</p>
        </div>
        
        {request.orderDetails && (
          <p className="text-sm mb-2 p-2 bg-muted/50 rounded text-muted-foreground">
            {request.orderDetails}
          </p>
        )}
        
        <div className="flex items-center text-xs text-muted-foreground mb-1">
          <CalendarDays className="h-4 w-4 mr-2" />
          Requested: {request.requestedAt ? format(new Date(request.requestedAt), 'MMM d, yyyy HH:mm') : '-'}
        </div>
        {request.completedAt && (
          <div className={cn("flex items-center text-xs", isCancelled ? "text-red-600" : "text-green-600")}> 
            {isCancelled ? (
              <X className="h-4 w-4 mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {isCancelled ? 'Cancelled' : 'Completed'}: {format(new Date(request.completedAt), 'MMM d, yyyy HH:mm')}
          </div>
        )}
        {request.cancelledAt && (
          <div className="flex items-center text-xs text-red-600">
            <X className="h-4 w-4 mr-2" />
            Cancelled: {format(new Date(request.cancelledAt), 'MMM d, yyyy HH:mm')}
            {request.cancelledBy && (
              <span className="ml-2 text-muted-foreground">by {request.cancelledBy}</span>
            )}
            {request.cancellationReason && (
              <span className="ml-2 text-muted-foreground">({request.cancellationReason})</span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="py-2 mt-auto">
        {isPending && (
          <>
            <Button 
              onClick={() => onMarkAsDone(request._id || request.requestId || '')}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 h-7 text-xs"
              aria-label={`Mark order for ${request.customerName} as processing`}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Processing
            </Button>
          </>
        )}
        {isProcessing && (
          <>
            <Button 
              onClick={() => onMarkAsDone(request._id || request.requestId || '')}
              className="w-full bg-green-500 hover:bg-green-400 text-white h-7 text-xs"
              aria-label={`Mark order for ${request.customerName} as delivered`}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Delivered
            </Button>
          </>
        )}
        {isDelivered && (
          <p className="text-xs text-green-600 font-medium w-full text-center">Delivery Fulfilled</p>
        )}
        {isCancelled && (
          <p className="text-xs text-red-600 font-medium w-full text-center">Request Cancelled</p>
        )}
      </CardFooter>
    </Card>
  );
};

export default RequestCard;

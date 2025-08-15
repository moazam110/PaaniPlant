
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, ListTodo, Clock } from 'lucide-react';

interface StaffDashboardMetricsProps {
  requests: DeliveryRequest[];
  requestCounts?: {
    pending: number;
    processing: number;
    urgent: number;
  };
}

const StaffDashboardMetrics: React.FC<StaffDashboardMetricsProps> = ({ requests, requestCounts }) => {
  // Use provided counts if available, otherwise calculate from requests
  const pendingCount = requestCounts?.pending ?? requests.filter(req => 
    (req.status === 'pending' || req.status === 'pending_confirmation')
  ).length;
  
  const processingCount = requestCounts?.processing ?? requests.filter(req => 
    req.status === 'processing'
  ).length;
  
  const urgentCount = requestCounts?.urgent ?? requests.filter(req => 
    req.priority === 'urgent' && 
    (req.status === 'pending' || req.status === 'pending_confirmation' || req.status === 'processing')
  ).length;

  return (
    <div className="grid gap-1 md:grid-cols-3 py-1">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline">Pending</CardTitle>
          <ListTodo className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold">{pendingCount}</div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm bg-yellow-50 border-yellow-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline text-yellow-700">Processing</CardTitle>
          <Clock className="h-3 w-3 text-yellow-600" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold text-yellow-700">{processingCount}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-destructive/10 border-destructive">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline text-destructive">Urgent</CardTitle>
          <Hourglass className="h-3 w-3 text-destructive" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold text-destructive">{urgentCount}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffDashboardMetrics;

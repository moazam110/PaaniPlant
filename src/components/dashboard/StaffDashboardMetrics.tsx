
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, ListTodo, Clock } from 'lucide-react';

interface StaffDashboardMetricsProps {
  requests: DeliveryRequest[];
}

const StaffDashboardMetrics: React.FC<StaffDashboardMetricsProps> = ({ requests }) => {
  // Count active tasks (pending + processing)
  const pendingCount = requests.filter(req => req.status === 'pending' || req.status === 'pending_confirmation').length;
  const processingCount = requests.filter(req => req.status === 'processing').length;
  const urgentCount = requests.filter(req => 
    req.priority === 'urgent' && 
    (req.status === 'pending' || req.status === 'pending_confirmation' || req.status === 'processing')
  ).length;

  return (
    <div className="grid gap-2 md:grid-cols-3 p-2 md:p-3">
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-semibold font-headline">Pending Tasks</CardTitle>
          <ListTodo className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="py-1">
          <div className="text-xl font-bold">{pendingCount}</div>
          <p className="text-[11px] text-muted-foreground">Waiting to be processed</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-md bg-yellow-50 border-yellow-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-semibold font-headline text-yellow-700">Processing Tasks</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent className="py-1">
          <div className="text-xl font-bold text-yellow-700">{processingCount}</div>
          <p className="text-[11px] text-yellow-600">Currently being delivered</p>
        </CardContent>
      </Card>

      <Card className="shadow-md bg-destructive/10 border-destructive">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-semibold font-headline text-destructive">Urgent Tasks</CardTitle>
          <Hourglass className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="py-1">
          <div className="text-xl font-bold text-destructive">{urgentCount}</div>
          <p className="text-[11px] text-destructive/80">High priority deliveries</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffDashboardMetrics;

    

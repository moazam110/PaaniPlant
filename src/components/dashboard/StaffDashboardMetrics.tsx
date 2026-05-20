
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, ListTodo, Clock } from 'lucide-react';

interface StaffDashboardMetricsProps {
  requests: DeliveryRequest[];
}

const StaffDashboardMetrics: React.FC<StaffDashboardMetricsProps> = ({ requests }) => {
  // Calculate counts from requests
  const pendingCount = requests.filter(req => 
    (req.status === 'pending' || req.status === 'pending_confirmation')
  ).length;
  
  const processingCount = requests.filter(req => 
    req.status === 'processing'
  ).length;
  
  const urgentCount = requests.filter(req => 
    req.priority === 'urgent' && 
    (req.status === 'pending' || req.status === 'pending_confirmation' || req.status === 'processing')
  ).length;

  return (
    <div className="grid grid-cols-3 gap-1 py-1">
      <Card className="shadow-sm bg-white dark:bg-card border border-blue-200 border-l-[3px] border-l-blue-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline text-blue-700 dark:text-foreground">Pending</CardTitle>
          <ListTodo className="h-3 w-3 text-blue-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold text-blue-700 dark:text-foreground">{pendingCount}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-yellow-50 border border-yellow-200 border-l-[3px] border-l-yellow-400">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline text-yellow-700">Processing</CardTitle>
          <Clock className="h-3 w-3 text-yellow-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold text-yellow-700">{processingCount}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-red-50 border border-red-200 border-l-[3px] border-l-red-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <CardTitle className="text-[10px] font-semibold font-headline text-red-600">Urgent</CardTitle>
          <Hourglass className="h-3 w-3 text-red-500" />
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <div className="text-sm font-bold text-red-600">{urgentCount}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffDashboardMetrics;

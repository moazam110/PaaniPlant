
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, ListTodo, Clock, Volume2, VolumeX } from 'lucide-react';

interface StaffDashboardMetricsProps {
  requests: DeliveryRequest[];
  audioEnabled?: boolean;
}

const StaffDashboardMetrics: React.FC<StaffDashboardMetricsProps> = ({ requests, audioEnabled = false }) => {
  // Count active tasks (pending + processing)
  const pendingCount = requests.filter(req => req.status === 'pending' || req.status === 'pending_confirmation').length;
  const processingCount = requests.filter(req => req.status === 'processing').length;
  const urgentCount = requests.filter(req => 
    req.priority === 'urgent' && 
    (req.status === 'pending' || req.status === 'pending_confirmation' || req.status === 'processing')
  ).length;

  return (
    <div className="space-y-4">
      {/* Audio Status Banner */}
      <div className="mx-4 md:mx-8 p-2 rounded-lg border flex items-center justify-center gap-2 text-sm">
        {audioEnabled ? (
          <>
            <Volume2 className="h-4 w-4 text-green-600" />
            <span className="text-green-600 font-medium">🔊 Sound notifications enabled</span>
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4 text-amber-600" />
            <span className="text-amber-600 font-medium">🔇 Click anywhere to enable sound notifications</span>
          </>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-3 p-4 md:p-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-headline">Pending Tasks</CardTitle>
          <ListTodo className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingCount}</div>
          <p className="text-xs text-muted-foreground">
            Waiting to be processed
          </p>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg bg-yellow-50 border-yellow-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-headline text-yellow-700">Processing Tasks</CardTitle>
          <Clock className="h-5 w-5 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-700">{processingCount}</div>
          <p className="text-xs text-yellow-600">
            Currently being delivered
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg bg-destructive/10 border-destructive">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-headline text-destructive">Urgent Tasks</CardTitle>
          <Hourglass className="h-5 w-5 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{urgentCount}</div>
          <p className="text-xs text-destructive/80">
            High priority deliveries
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default StaffDashboardMetrics;

    

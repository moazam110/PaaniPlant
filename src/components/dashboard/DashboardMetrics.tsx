
import type React from 'react';
import type { DeliveryRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, CheckCircle2 } from 'lucide-react';

// This component might become deprecated or specific if Admin page uses its own metric cards.
// For now, it's used by StaffPage and reflects counts based on the requests passed to it.
interface DashboardMetricsProps {
  requests: DeliveryRequest[]; // These are typically pending requests for staff
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ requests }) => {
  // For staff, "pending" are effectively "pending" or "to-do"
  const pendingCount = requests.filter(req => req.status === 'pending' || req.status === 'pending_confirmation').length;
  
  // "Delivered" count is not directly applicable here if 'requests' only contains pending ones.
  // If you want to show overall delivered count, it would need a different data source or prop.
  // For now, let's adapt it to show something relevant to the passed `requests`.
  // Example: if staff page also showed *their* completed tasks for the day, this could be used.
  // For now, this card might be less relevant or show 0.
  const deliveredCount = requests.filter(req => req.status === 'delivered').length;


  return (
    <div className="grid gap-4 md:grid-cols-2 p-4 md:p-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-headline">My Pending Tasks</CardTitle>
          <Hourglass className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingCount}</div>
          <p className="text-xs text-muted-foreground">
            Deliveries assigned or planned
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-headline">Completed by Me (Session)</CardTitle>
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{deliveredCount}</div>
          <p className="text-xs text-muted-foreground">
            Count based on current view
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardMetrics;
    

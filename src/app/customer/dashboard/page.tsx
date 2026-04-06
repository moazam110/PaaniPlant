/**
 * Customer Dashboard Page - Server Component
 * 
 * This server component fetches initial data for the customer dashboard.
 * Phase 4: Protected route - authentication is handled in client component
 */

import { Suspense } from 'react';
import { fetchDeliveryRequests } from '@/lib/server-api';
import CustomerDashboardClient from '@/components/customer/CustomerDashboardClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function CustomerDashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/50 animate-gradient"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(63,81,181,0.4),transparent_50%)] animate-pulse"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(48,63,159,0.4),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="relative z-10 w-full max-w-6xl">
        <Card className="glass-card">
          <CardHeader><CardTitle>Loading Dashboard...</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto bg-muted/50" />
            <Skeleton className="h-12 w-full bg-muted/50" />
            <Skeleton className="h-12 w-full bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Server Component - no "use client"
export default async function CustomerDashboardPage() {
  // Fetch all requests - client component will filter by authenticated customer
  const initialRequests = await fetchDeliveryRequests(1, 1000).catch(() => []);

  return (
    <Suspense fallback={<CustomerDashboardSkeleton />}>
      <CustomerDashboardClient initialRequests={initialRequests} />
    </Suspense>
  );
}


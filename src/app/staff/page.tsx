/**
 * Staff Dashboard Page - Server Component
 * 
 * PHASE 2: Server-Side Rendering (SSR)
 * 
 * This server component fetches initial data on the server before sending to client.
 * This eliminates the initial client-side fetch delay, providing instant content.
 */

import { Suspense } from 'react';
import { fetchDeliveryRequests } from '@/lib/server-api';
import StaffDashboardClient from '@/components/staff/StaffDashboardClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/shared/Header';

function StaffDashboardSkeleton() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header title="Staff Delivery Interface" />
            <main className="flex-grow p-4 md:p-8">
                <Skeleton className="h-24 w-full mb-6 bg-muted/50" /> 
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="bg-card shadow-md">
                            <CardHeader><Skeleton className="h-6 w-3/4 bg-muted/50" /></CardHeader>
                            <CardContent><Skeleton className="h-16 w-full bg-muted/50" /></CardContent>
                        </Card>
                    ))}
                </div>
            </main>
            <div className="p-4 border-t border-[hsl(var(--border))]/20 bg-background/30">
              <Skeleton className="h-10 w-32 mx-auto bg-muted/50" />
            </div>
        </div>
    );
  }

// Server Component - no "use client"
export default async function StaffPage() {
  // PHASE 2: Fetch initial data on server
  // PHASE 4: Use pagination to limit initial load (100 records max)
  // This eliminates the client-side fetch delay on initial load
  const initialRequests = await fetchDeliveryRequests(1, 100).catch(() => []); // Limit to 100 records for initial load

  return (
    <Suspense fallback={<StaffDashboardSkeleton />}>
      <StaffDashboardClient initialRequests={initialRequests} />
    </Suspense>
  );
}


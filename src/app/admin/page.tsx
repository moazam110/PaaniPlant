/**
 * Admin Dashboard Page - Server Component
 * 
 * PHASE 2: Server-Side Rendering (SSR)
 * 
 * This server component fetches initial data on the server before sending to client.
 * This eliminates the initial client-side fetch delay, providing instant content.
 * 
 * Key Benefits:
 * - Initial data loads on server (no client-side fetch delay)
 * - Better SEO (content in HTML)
 * - Faster perceived load time
 * - Client component handles all interactivity
 */

import { Suspense } from 'react';
import { fetchDashboardMetrics, fetchDeliveryRequests } from '@/lib/server-api';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";

function AdminDashboardSkeleton() {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--accent))]/10">
        <Card className="w-full max-w-md text-center glass-card">
          <CardHeader><CardTitle>Loading Dashboard...</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto bg-muted/50" />
          <Skeleton className="h-12 w-full bg-muted/50" />
          <Skeleton className="h-12 w-full bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
// Server Component - no "use client"
export default async function AdminDashboardPage() {
  // PHASE 2: Fetch initial data on server - parallel execution
  // PHASE 4: Use pagination to limit initial load (100 records max)
  // This eliminates the client-side fetch delay on initial load
  const [initialMetrics, initialRequests] = await Promise.all([
    fetchDashboardMetrics().catch(() => null),
    fetchDeliveryRequests(1, 100).catch(() => []) // Limit to 100 records for initial load
  ]);
  
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardClient 
        initialMetrics={initialMetrics}
        initialRequests={initialRequests}
                        />
    </Suspense>
  );
}

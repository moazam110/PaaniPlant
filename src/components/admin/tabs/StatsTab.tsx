"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ListChecks, PackageCheck, PackageSearch } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

interface StatsTabProps {
  totalCustomers: number;
  pendingDeliveries: number;
  deliveriesTodayCount: number;
  totalCansToday: number;
}

export default function StatsTab({
  totalCustomers,
  pendingDeliveries,
  deliveriesTodayCount,
  totalCansToday
}: StatsTabProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {totalCustomers >= 0 ? (
              <div className="text-2xl font-bold">{totalCustomers}</div>
            ) : (
              <Skeleton className="h-7 w-12 bg-muted/50" />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pendingDeliveries >= 0 ? (
              <div className="text-2xl font-bold">{pendingDeliveries}</div>
            ) : (
              <Skeleton className="h-7 w-12 bg-muted/50" />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deliveries Today</CardTitle>
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {deliveriesTodayCount >= 0 ? (
              <div className="text-2xl font-bold">{deliveriesTodayCount}</div>
            ) : (
              <Skeleton className="h-7 w-12 bg-muted/50" />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cans Delivered Today</CardTitle>
            <PackageSearch className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {totalCansToday >= 0 ? (
              <div className="text-2xl font-bold">{totalCansToday}</div>
            ) : (
              <Skeleton className="h-7 w-12 bg-muted/50" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {deliveriesTodayCount >= 0 ? Math.round((deliveriesTodayCount / Math.max(pendingDeliveries + deliveriesTodayCount, 1)) * 100) : 0}%
              </div>
              <div className="text-sm text-green-600 font-medium">Completion Rate</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {totalCustomers > 0 && deliveriesTodayCount >= 0 ? Math.round((totalCansToday / totalCustomers) * 10) / 10 : 0}
              </div>
              <div className="text-sm text-blue-600 font-medium">Avg Cans/Customer</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
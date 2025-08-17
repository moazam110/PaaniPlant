"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Shield, Activity, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { superAdminAPI } from '@/lib/super-admin-api';
import { useToast } from '@/hooks/use-toast';

interface DashboardData {
  systemStats: {
    totalAdmins: number;
    activeAdmins: number;
    suspendedAdmins: number;
    failedLogins: number;
    suspiciousActivities: number;
    lastSecurityScan: string;
  };
  activityMetrics: {
    newAdmins: number;
    systemLogins: number;
    actionsToday: number;
  };
}

export function SuperAdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, getAuthHeaders } = useAuth();
  const { toast } = useToast();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const data = await superAdminAPI.getDashboardMetrics();
      setDashboardData(data);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh dashboard data
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchDashboardData();
      toast({
        title: "Success",
        description: "Dashboard data refreshed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to refresh dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Use dashboard data or fallback to default values
  const systemStats = dashboardData?.systemStats || {
    totalAdmins: 0,
    activeAdmins: 0,
    suspendedAdmins: 0,
    failedLogins: 0,
    suspiciousActivities: 0,
    lastSecurityScan: 'Never'
  };

  const activityMetrics = dashboardData?.activityMetrics || {
    newAdmins: 0,
    systemLogins: 0,
    actionsToday: 0
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview and security monitoring</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Overview</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Admins:</span>
                <span className="font-medium">{systemStats.totalAdmins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {systemStats.activeAdmins}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Suspended:</span>
                <Badge variant="destructive">{systemStats.suspendedAdmins}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Failed Logins:</span>
                <Badge variant={systemStats.failedLogins > 0 ? "destructive" : "default"}>
                  {systemStats.failedLogins}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Suspicious:</span>
                <Badge variant={systemStats.suspiciousActivities > 0 ? "destructive" : "default"}>
                  {systemStats.suspiciousActivities}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Scan:</span>
                <span className="text-xs text-muted-foreground">{systemStats.lastSecurityScan}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Metrics</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">New Admins:</span>
                <Badge variant="secondary">{activityMetrics.newAdmins}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">System Logins:</span>
                <span className="font-medium">{activityMetrics.systemLogins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Actions Today:</span>
                <span className="font-medium">{activityMetrics.actionsToday}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 transition-colors">
                Create New Admin
              </button>
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 transition-colors">
                View Security Logs
              </button>
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800 transition-colors">
                Generate Report
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

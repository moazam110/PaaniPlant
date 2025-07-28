"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ListChecks, PackageCheck, PackageSearch, IndianRupee } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { buildApiUrl } from '@/lib/api';

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
  // State for month/year filtering
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  
  // State for filtered metrics
  const [filteredMetrics, setFilteredMetrics] = useState({
    deliveries: deliveriesTodayCount,
    totalCans: totalCansToday,
    totalAmountGenerated: 0,
    timeLabel: 'Today',
    isLoading: false
  });
  
  // Months array for dropdown
  const months = [
    { value: '1', label: 'Jan' },
    { value: '2', label: 'Feb' },
    { value: '3', label: 'Mar' },
    { value: '4', label: 'Apr' },
    { value: '5', label: 'May' },
    { value: '6', label: 'Jun' },
    { value: '7', label: 'Jul' },
    { value: '8', label: 'Aug' },
    { value: '9', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' }
  ];
  
  // Years array for dropdown (current year + 5 previous years)
  const years = Array.from({ length: 6 }, (_, i) => {
    const year = currentDate.getFullYear() - i;
    return { value: String(year), label: String(year) };
  });

  // Fetch filtered metrics when month/year changes
  const fetchFilteredMetrics = async (month?: string, year?: string) => {
    setFilteredMetrics(prev => ({ ...prev, isLoading: true }));
    
    try {
      let metricsUrl = buildApiUrl('api/dashboard/metrics');
      if (month && year) {
        metricsUrl += `?month=${month}&year=${year}`;
      }
      
      const response = await fetch(metricsUrl);
      if (response.ok) {
        const data = await response.json();
        setFilteredMetrics({
          deliveries: data.deliveries || 0,
          totalCans: data.totalCans || 0,
          totalAmountGenerated: data.totalAmountGenerated || 0,
          timeLabel: data.timeLabel || 'Today',
          isLoading: false
        });
        setIsMonthlyView(data.isMonthlyView || false);
      } else {
        console.error('Failed to fetch filtered metrics');
        setFilteredMetrics(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error fetching filtered metrics:', error);
      setFilteredMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Handle dropdown selection
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month && selectedYear) {
      fetchFilteredMetrics(month, selectedYear);
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    if (selectedMonth && year) {
      fetchFilteredMetrics(selectedMonth, year);
    }
  };



  // Initialize with 24-hour data
  useEffect(() => {
    fetchFilteredMetrics();
  }, []);

  return (
    <div className="p-4 space-y-6">
      {/* Month/Year Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex gap-3">
          <div className="w-32">
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        

      </div>

      {/* Main Stats Grid */}
      {isMonthlyView ? (
        // Monthly View - Only 3 KPIs
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <PackageCheck className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-12 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold">{filteredMetrics.deliveries}</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Delivered Cans</CardTitle>
              <PackageSearch className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-12 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold">{filteredMetrics.totalCans}</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Amount Generated</CardTitle>
            <IndianRupee className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-12 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  Rs. {filteredMetrics.totalAmountGenerated.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // 24-Hour View - All KPIs including total amount
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-12 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold">{filteredMetrics.deliveries}</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cans Delivered Today</CardTitle>
              <PackageSearch className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-12 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold">{filteredMetrics.totalCans}</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Amount Generated Today</CardTitle>
            <IndianRupee className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {filteredMetrics.isLoading ? (
                <Skeleton className="h-7 w-20 bg-muted/50" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  Rs. {filteredMetrics.totalAmountGenerated.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Total cans × individual customer prices
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}